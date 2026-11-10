import JSZip from 'jszip';
import { BANK_PAYMENT_VOUCHER_TEMPLATE_BASE64 } from '../assets/bankPaymentVoucherTemplateBase64';
import type { BankPaymentVoucherDocument } from '../types/bankPaymentVoucher';
import { formatIndonesianDateOnly } from '../utils/dateFormatter';
import { generateBankPaymentVoucherFileName } from '../utils/bankPaymentVoucherUtils';
import { terbilangRupiah } from '../utils/terbilang';

function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js fallback
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function updateCell(xml: string, cellRef: string, innerContent: string, extraAttrs = ''): string {
  const regex = new RegExp(`(<c\\s+r="${cellRef}"(?:\\s+s="(\\d+)")?)[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/c>)`);
  return xml.replace(regex, (_match, _prefix, sId) => {
    const sAttr = sId ? ` s="${sId}"` : '';
    const attrs = extraAttrs ? ` ${extraAttrs}` : '';
    if (!innerContent) {
      return `<c r="${cellRef}"${sAttr}${attrs}/>`;
    }
    return `<c r="${cellRef}"${sAttr}${attrs}>${innerContent}</c>`;
  });
}

function setCellText(xml: string, cellRef: string, text: string): string {
  return updateCell(xml, cellRef, text ? `<is><t>${escapeXml(text)}</t></is>` : '', 't="inlineStr"');
}

function setCellNumber(xml: string, cellRef: string, num: number, formula?: string): string {
  const inner = formula ? `<f>${formula}</f><v>${num}</v>` : `<v>${num}</v>`;
  return updateCell(xml, cellRef, inner);
}

/**
 * Generate an Excel (.xlsx) file based on the original Bank Payment Voucher template.
 * Injects Pay To, Date, No Voucher, Total Amount, In Word, Items, Bank Info, and Signatures.
 */
export async function generateBankPaymentVoucherExcelBlob(
  doc: Partial<BankPaymentVoucherDocument>
): Promise<Blob> {
  const templateBytes = base64ToUint8Array(BANK_PAYMENT_VOUCHER_TEMPLATE_BASE64);
  const zip = await JSZip.loadAsync(templateBytes);
  let s1Xml = await zip.file('xl/worksheets/sheet1.xml')?.async('text');
  if (!s1Xml) throw new Error('Berkas template worksheet sheet1.xml tidak ditemukan.');

  const items = doc.items || [];
  const itemCount = items.length;
  const totalAmount = doc.totalAmount || 0;
  const inWord = doc.inWord || terbilangRupiah(totalAmount);
  const formattedDate = formatIndonesianDateOnly(doc.voucherDate || new Date());
  const voucherNumber = doc.voucherNumber || 'VO-           /IX/2026';

  // 1. Kop Perusahaan (Rows 3 - 5)
  if (doc.companyName) s1Xml = setCellText(s1Xml, 'C3', doc.companyName);
  if (doc.companyAddress) s1Xml = setCellText(s1Xml, 'C4', doc.companyAddress);
  if (doc.companyCountry) s1Xml = setCellText(s1Xml, 'C5', doc.companyCountry);

  // 2. Metadata (Rows 7 - 9)
  s1Xml = setCellText(s1Xml, 'E7', doc.payTo || '');
  s1Xml = setCellText(s1Xml, 'H7', `: ${formattedDate}`);
  s1Xml = setCellText(s1Xml, 'H8', `: ${voucherNumber}`);
  s1Xml = setCellText(s1Xml, 'E9', inWord);

  const effectiveCount = Math.max(itemCount, 1);
  const delta = effectiveCount - 8;
  const totalRowNum = 19 + delta;
  const bankRow1 = 21 + delta;
  const bankRow2 = 22 + delta;
  const bankRow3 = 23 + delta;
  const sigRowNames = 30 + delta;

  if (delta === 0) {
    // Tepat 8 baris item transaksi
    for (let i = 0; i < 8; i++) {
      const r = 11 + i;
      const itm = items[i];
      s1Xml = setCellText(s1Xml, `C${r}`, `${i + 1}.`);
      s1Xml = setCellText(s1Xml, `D${r}`, itm?.accNo || '');
      s1Xml = setCellText(s1Xml, `E${r}`, itm?.description || '');
      s1Xml = setCellText(s1Xml, `G${r}`, itm?.accName || '');
      s1Xml = setCellNumber(s1Xml, `H${r}`, itm?.amount || 0);
    }
  } else if (delta < 0) {
    // Kurang dari 8 item (misal: 1 item atau 4 item) -> hilangkan baris kosong di bawahnya
    // 1. Isi baris rincian yang ada
    for (let i = 0; i < effectiveCount; i++) {
      const r = 11 + i;
      const itm = items[i];
      s1Xml = setCellText(s1Xml, `C${r}`, `${i + 1}.`);
      s1Xml = setCellText(s1Xml, `D${r}`, itm?.accNo || '');
      s1Xml = setCellText(s1Xml, `E${r}`, itm?.description || '');
      s1Xml = setCellText(s1Xml, `G${r}`, itm?.accName || '');
      s1Xml = setCellNumber(s1Xml, `H${r}`, itm?.amount || 0);
    }

    // 2. Hapus baris template yang tidak terpakai (mulai dari 11 + effectiveCount s.d 18)
    const removeStartRow = 11 + effectiveCount;
    for (let r = removeStartRow; r <= 18; r++) {
      const rowRegex = new RegExp(`<row\\s+r="${r}"[\\s\\S]*?<\\/row>\\r?\\n?`);
      s1Xml = s1Xml.replace(rowRegex, '');
      const mergeRegex = new RegExp(`<mergeCell\\s+ref="E${r}:F${r}"\\/>\\r?\\n?`);
      s1Xml = s1Xml.replace(mergeRegex, '');
    }

    // 3. Geser baris-baris setelahnya (Total, Info Bank, Tanda Tangan) ke atas sebanyak delta
    const lastKeptRow = removeStartRow - 1;
    const splitPoint = s1Xml.indexOf('</row>', s1Xml.indexOf(`<row r="${lastKeptRow}"`)) + 6;
    const beforePart = s1Xml.slice(0, splitPoint);
    let afterPart = s1Xml.slice(splitPoint);

    afterPart = afterPart.replace(/<row r="(\d+)"/g, (_m, rStr) => {
      const rNum = parseInt(rStr);
      return `<row r="${rNum + delta}"`;
    });
    afterPart = afterPart.replace(/<c r="([A-Z]+)(\d+)"/g, (_m, col, rStr) => {
      const rNum = parseInt(rStr);
      return `<c r="${col}${rNum + delta}"`;
    });
    afterPart = afterPart.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, c1, r1Str, c2, r2Str) => {
      const r1 = parseInt(r1Str);
      const r2 = parseInt(r2Str);
      if (r1 >= 19) {
        return `<mergeCell ref="${c1}${r1 + delta}:${c2}${r2 + delta}"/>`;
      }
      return m;
    });

    afterPart = afterPart.replace(/<mergeCells count="(\d+)">/, (_m, cStr) => {
      const newCount = parseInt(cStr) + delta; // delta bernilai negatif
      return `<mergeCells count="${newCount}">`;
    });

    s1Xml = beforePart + afterPart;
  } else {
    // Lebih dari 8 item -> ekspansi baris dinamis
    for (let i = 0; i < 8; i++) {
      const r = 11 + i;
      const itm = items[i];
      s1Xml = setCellText(s1Xml, `C${r}`, `${i + 1}.`);
      s1Xml = setCellText(s1Xml, `D${r}`, itm?.accNo || '');
      s1Xml = setCellText(s1Xml, `E${r}`, itm?.description || '');
      s1Xml = setCellText(s1Xml, `G${r}`, itm?.accName || '');
      s1Xml = setCellNumber(s1Xml, `H${r}`, itm?.amount || 0);
    }

    const extraRowsXml: string[] = [];
    const extraMerges: string[] = [];
    for (let i = 8; i < effectiveCount; i++) {
      const r = 11 + i;
      const itm = items[i];
      extraRowsXml.push(
        `<row r="${r}" spans="2:9">` +
        `<c r="B${r}" s="24"/>` +
        `<c r="C${r}" s="25" t="inlineStr"><is><t>${i + 1}.</t></is></c>` +
        `<c r="D${r}" s="26"${itm?.accNo ? ` t="inlineStr"><is><t>${escapeXml(itm.accNo)}</t></is></c>` : '/>'}` +
        `<c r="E${r}" s="52" t="inlineStr"><is><t>${escapeXml(itm?.description || '')}</t></is></c>` +
        `<c r="F${r}" s="28"/>` +
        `<c r="G${r}" s="26"${itm?.accName ? ` t="inlineStr"><is><t>${escapeXml(itm.accName)}</t></is></c>` : '/>'}` +
        `<c r="H${r}" s="29"><v>${itm?.amount || 0}</v></c>` +
        `<c r="I${r}" s="8"/>` +
        `</row>`
      );
      extraMerges.push(`<mergeCell ref="E${r}:F${r}"/>`);
    }

    const splitPoint = s1Xml.indexOf('</row>', s1Xml.indexOf('<row r="18"')) + 6;
    const beforePart = s1Xml.slice(0, splitPoint);
    let afterPart = s1Xml.slice(splitPoint);

    afterPart = afterPart.replace(/<row r="(\d+)"/g, (_m, rStr) => {
      const rNum = parseInt(rStr);
      return `<row r="${rNum + delta}"`;
    });
    afterPart = afterPart.replace(/<c r="([A-Z]+)(\d+)"/g, (_m, col, rStr) => {
      const rNum = parseInt(rStr);
      return `<c r="${col}${rNum + delta}"`;
    });
    afterPart = afterPart.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, c1, r1Str, c2, r2Str) => {
      const r1 = parseInt(r1Str);
      const r2 = parseInt(r2Str);
      if (r1 >= 19) {
        return `<mergeCell ref="${c1}${r1 + delta}:${c2}${r2 + delta}"/>`;
      }
      return m;
    });

    if (extraMerges.length > 0) {
      afterPart = afterPart.replace(/<mergeCells count="(\d+)">/, (_m, cStr) => {
        const newCount = parseInt(cStr) + extraMerges.length;
        return `<mergeCells count="${newCount}">\n${extraMerges.join('\n')}`;
      });
    }

    s1Xml = beforePart + '\n' + extraRowsXml.join('\n') + afterPart;
  }

  // Set Total Amount in E8 and H{totalRowNum}
  s1Xml = setCellNumber(s1Xml, 'E8', totalAmount, `H${totalRowNum}`);
  s1Xml = setCellNumber(s1Xml, `H${totalRowNum}`, totalAmount);

  // Bank Info
  s1Xml = setCellText(s1Xml, `E${bankRow1}`, `: ${doc.bankName || 'BCA'}`);
  s1Xml = setCellText(s1Xml, `E${bankRow2}`, `: ${doc.bankAccount || ''}`);
  s1Xml = setCellText(s1Xml, `E${bankRow3}`, `: ${doc.bankAccountName || doc.payTo || ''}`);

  // Approvals (Row Names)
  s1Xml = setCellText(s1Xml, `C${sigRowNames}`, doc.preparedByName || doc.payTo || '');
  s1Xml = setCellText(s1Xml, `E${sigRowNames}`, doc.processedName || 'Elsya');
  s1Xml = setCellText(s1Xml, `F${sigRowNames}`, doc.recordedByName || 'Sarah');
  s1Xml = setCellText(s1Xml, `G${sigRowNames}`, doc.approvedByName || '');
  s1Xml = setCellText(s1Xml, `H${sigRowNames}`, doc.acknowledgedByName || 'Nandar Munandar');

  zip.file('xl/worksheets/sheet1.xml', s1Xml);

  const arrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Downloads the Excel (.xlsx) file directly to the user's browser.
 */
export async function downloadBankPaymentVoucherExcel(
  doc: Partial<BankPaymentVoucherDocument>
): Promise<void> {
  const blob = await generateBankPaymentVoucherExcelBlob(doc);
  const fileName = generateBankPaymentVoucherFileName(doc, 'xlsx');

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

