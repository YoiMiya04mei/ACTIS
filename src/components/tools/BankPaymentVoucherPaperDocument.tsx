import React from 'react';
import type { BankPaymentVoucherDocument } from '@/types/bankPaymentVoucher';
import { formatCurrencyNumber } from '@/utils/bankPaymentVoucherUtils';
import { formatIndonesianDateOnly } from '@/utils/dateFormatter';
import { terbilangRupiah } from '@/utils/terbilang';

export interface BankPaymentVoucherPaperDocumentProps {
  doc: Partial<BankPaymentVoucherDocument>;
  id?: string;
}

export const BankPaymentVoucherPaperDocument: React.FC<BankPaymentVoucherPaperDocumentProps> = ({
  doc,
  id = 'bank-payment-voucher-paper-doc',
}) => {
  const companyName = doc.companyName || 'PT. Jembatan Data Pangrango';
  const companyAddress =
    doc.companyAddress ||
    'Jl. Pabuaran No.51, Nyomplong, Kec. Warudoyong, Kota Sukabumi';
  const companyCountry = doc.companyCountry || 'Jawa Barat - Indonesia';

  const voucherDateFormatted = formatIndonesianDateOnly(doc.voucherDate || new Date());
  const voucherNumber = doc.voucherNumber || 'VO-           /IX/2026';
  const payTo = doc.payTo || 'PERMADI PRATAMA';
  const totalAmount = doc.totalAmount || 0;
  const inWord = doc.inWord || terbilangRupiah(totalAmount);

  const items = doc.items || [];
  // Sesuaikan jumlah baris secara dinamis sesuai item yang diisi (tanpa baris kosong di bawahnya)
  const displayRows = items.length > 0 ? items : [null];

  return (
    <div
      id={id}
      className="bank-voucher-container bank-voucher-page w-[794px] min-h-[1123px] bg-white text-black p-8 sm:px-12 sm:py-10 shadow-lg mx-auto print:shadow-none print:m-0 print:p-6 print:w-full print:min-h-0 relative flex flex-col justify-between"
      style={{
        boxSizing: 'border-box',
        fontFamily: "Calibri, 'Segoe UI', Arial, sans-serif",
      }}
    >
      <div>
        {/* ==================================================================== */}
        {/* TABEL TUNGGAL TATA LETAK SPREADSHEET EXCEL (COLUMNS C, D, E, F, G, H)*/}
        {/* ==================================================================== */}
        <table className="w-full border-collapse table-fixed text-[11pt] text-black">
          <colgroup>
            <col style={{ width: '3.5%' }} />  {/* C: No */}
            <col style={{ width: '12.5%' }} /> {/* D: Acc No */}
            <col style={{ width: '20.0%' }} /> {/* E: Desc pt1 / Amount Box / Processed */}
            <col style={{ width: '30.0%' }} /> {/* F: Desc pt2 / Recorded by */}
            <col style={{ width: '14.0%' }} /> {/* G: Acc Name / Date / No. Voucher / Approved by */}
            <col style={{ width: '20.0%' }} /> {/* H: Amount / Date Val / No. Voucher Val / Acknowledged by */}
          </colgroup>
          <tbody>
            {/* Row 3: Kop Surat - Nama Perusahaan */}
            <tr className="h-6">
              <td colSpan={6} className="text-center font-bold text-[14pt] leading-tight">
                {companyName}
              </td>
            </tr>

            {/* Row 4: Kop Surat - Alamat Perusahaan */}
            <tr className="h-6">
              <td colSpan={6} className="text-center font-bold text-[14pt] leading-tight">
                {companyAddress}
              </td>
            </tr>

            {/* Row 5: Kop Surat - Wilayah / Negara */}
            <tr className="h-6">
              <td colSpan={6} className="text-center font-bold text-[14pt] leading-tight">
                {companyCountry}
              </td>
            </tr>

            {/* Spacing Antara Kop dan Judul */}
            <tr className="h-4">
              <td colSpan={6}></td>
            </tr>

            {/* Row 6: Judul Dokumen */}
            <tr className="h-7">
              <td colSpan={6} className="text-center font-bold uppercase text-[13pt] tracking-wider border-b border-black">
                BANK PAYMENT VOUCHER
              </td>
            </tr>

            {/* Spacing Antara Judul dan Metadata */}
            <tr className="h-3">
              <td colSpan={6}></td>
            </tr>

            {/* Row 7: Pay To & Date */}
            <tr className="h-7">
              <td colSpan={2} className="align-middle font-normal pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>Pay To</span>
                  <span>:</span>
                </div>
              </td>
              <td colSpan={2} className="align-middle font-bold uppercase pl-2">
                {payTo}
              </td>
              <td className="align-middle text-left pl-2 font-normal whitespace-nowrap">
                Date
              </td>
              <td className="align-middle text-left pl-1 font-normal font-mono whitespace-nowrap">
                : {voucherDateFormatted}
              </td>
            </tr>

            {/* Row 8: Total Amount & No. Voucher */}
            <tr className="h-7">
              <td colSpan={2} className="align-middle font-normal pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>Total Amount</span>
                  <span>:</span>
                </div>
              </td>
              <td className="align-middle text-left pl-2 font-bold font-mono">
                {formatCurrencyNumber(totalAmount)}
              </td>
              <td className="align-middle"></td>
              <td className="align-middle text-left pl-2 font-normal whitespace-nowrap">
                No. Voucher
              </td>
              <td className="align-middle text-left pl-1 font-normal font-mono whitespace-nowrap">
                : {voucherNumber}
              </td>
            </tr>

            {/* Row 9: In Word */}
            <tr className="h-7">
              <td colSpan={2} className="align-middle font-bold pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>In Word</span>
                  <span>:</span>
                </div>
              </td>
              <td colSpan={4} className="align-middle font-bold pl-2 border-t border-b border-black">
                {inWord}
              </td>
            </tr>

            {/* Spacing Antara Metadata dan Tabel */}
            <tr className="h-2">
              <td colSpan={6}></td>
            </tr>

            {/* Row 10: Header Tabel Item */}
            <tr className="h-7 border-t border-b border-black">
              <th className="font-semibold text-center py-1">No</th>
              <th className="font-semibold text-center py-1">Acc No</th>
              <th colSpan={2} className="font-semibold text-center py-1">Description</th>
              <th className="font-semibold text-center py-1">Acc Name</th>
              <th className="font-semibold text-center py-1">Amount</th>
            </tr>

            {/* Rows 11 - 18 (atau lebih): Baris Rincian Transaksi */}
            {displayRows.map((item, idx) => (
              <tr key={item?.id || `empty-row-${idx}`} className="h-7">
                {/* Kolom No (Border Kanan) */}
                <td className="text-center align-middle border-r border-black py-0.5">
                  {item ? `${idx + 1}.` : ''}
                </td>

                {/* Kolom Acc No */}
                <td className="text-center align-middle py-0.5 px-1 font-mono text-xs">
                  {item?.accNo || ''}
                </td>

                {/* Kolom Description (Merged Cols E + F) */}
                <td colSpan={2} className="text-left align-middle py-0.5 px-2">
                  {item?.description || ''}
                </td>

                {/* Kolom Acc Name */}
                <td className="text-center align-middle py-0.5 px-1 text-xs">
                  {item?.accName || ''}
                </td>

                {/* Kolom Amount (Border Kiri & Bawah) */}
                <td className="text-right align-middle border-l border-b border-black py-0.5 pr-2 font-mono">
                  {item ? formatCurrencyNumber(item.amount) : ''}
                </td>
              </tr>
            ))}

            {/* Row 19: Total Row */}
            <tr className="h-8">
              <td colSpan={5} className="align-middle text-left font-normal pl-2">
                Total
              </td>
              <td className="align-middle text-right font-bold border-b border-black pr-2 font-mono">
                {formatCurrencyNumber(totalAmount)}
              </td>
            </tr>

            {/* Spacing Antara Total dan Info Bank (Row 20) */}
            <tr className="h-3">
              <td colSpan={6}></td>
            </tr>

            {/* Row 21: Bank Info - Bank */}
            <tr className="h-6">
              <td colSpan={2} className="align-middle font-normal pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>Bank </span>
                  <span>:</span>
                </div>
              </td>
              <td colSpan={4} className="align-middle font-bold uppercase pl-2">
                {doc.bankName || 'BCA'}
              </td>
            </tr>

            {/* Row 22: Bank Info - Account */}
            <tr className="h-6">
              <td colSpan={2} className="align-middle font-normal pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>Account</span>
                  <span>:</span>
                </div>
              </td>
              <td colSpan={4} className="align-middle font-bold font-mono pl-2">
                {doc.bankAccount || '0382576762'}
              </td>
            </tr>

            {/* Row 23: Bank Info - Name */}
            <tr className="h-6">
              <td colSpan={2} className="align-middle font-normal pl-1 pr-2">
                <div className="flex justify-between items-center w-full">
                  <span>Name</span>
                  <span>:</span>
                </div>
              </td>
              <td colSpan={4} className="align-middle font-bold uppercase pl-2">
                {doc.bankAccountName || payTo}
              </td>
            </tr>

            {/* Spacing Antara Info Bank dan Persetujuan (Row 24) */}
            <tr className="h-3">
              <td colSpan={6}></td>
            </tr>

            {/* Row 25: Header Kolom Persetujuan */}
            <tr className="h-7 border-t border-black">
              <th colSpan={2} className="font-normal text-center border-l border-r border-black py-1">
                Prepared by
              </th>
              <th className="font-normal text-center border-r border-black py-1">
                Processed
              </th>
              <th className="font-normal text-center border-r border-black py-1">
                Recorded by
              </th>
              <th className="font-normal text-center border-r border-black py-1">
                Approved by
              </th>
              <th className="font-normal text-center border-r border-black py-1">
                Acknowledged by
              </th>
            </tr>

            {/* Rows 26 - 29: Ruang Tanda Tangan (~75px) */}
            <tr className="h-20">
              <td colSpan={2} className="border-l border-r border-black align-middle p-1 relative text-center">
                {doc.preparedBySignature ? (
                  <div className="h-16 flex items-center justify-center">
                    <img
                      src={doc.preparedBySignature}
                      alt="TTD Prepared by"
                      crossOrigin="anonymous"
                      className="max-h-16 max-w-[120px] object-contain pointer-events-none select-none mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <div className="h-16" />
                )}
              </td>
              <td className="border-r border-black align-middle p-1">
                <div className="h-16" />
              </td>
              <td className="border-r border-black align-middle p-1">
                <div className="h-16" />
              </td>
              <td className="border-r border-black align-middle p-1">
                <div className="h-16" />
              </td>
              <td className="border-r border-black align-middle p-1">
                <div className="h-16" />
              </td>
            </tr>

            {/* Row 30: Nama Penandatangan */}
            <tr className="h-7 border-b border-black font-normal">
              <td colSpan={2} className="border-l border-r border-black py-1 px-1 text-center align-middle truncate">
                {doc.preparedByName || payTo}
              </td>
              <td className="border-r border-black py-1 px-1 text-center align-middle truncate">
                {doc.processedName || 'Elsya'}
              </td>
              <td className="border-r border-black py-1 px-1 text-center align-middle truncate">
                {doc.recordedByName || 'Sarah'}
              </td>
              <td className="border-r border-black py-1 px-1 text-center align-middle truncate">
                {doc.approvedByName || ''}
              </td>
              <td className="border-r border-black py-1 px-1 text-center align-middle truncate">
                {doc.acknowledgedByName || 'Nandar Munandar'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BankPaymentVoucherPaperDocument;
