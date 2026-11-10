import React from 'react';
import type { PermitBarangDocument, PermitBarangTemplate } from '@/types/permitBarang';
import type { RFOTemplate } from '@/types/rfo';
import {
  formatPermitBarangDate,
  formatPermitBarangHeaderDate,
  isPermitBarangMultiPage,
} from '@/utils/permitBarangUtils';

export interface PermitBarangPaperDocumentProps {
  doc: Partial<PermitBarangDocument>;
  template?: PermitBarangTemplate | RFOTemplate;
  id?: string;
  previewPageFilter?: 'all' | 1 | 2;
}

export const PermitBarangPaperDocument: React.FC<PermitBarangPaperDocumentProps> = ({
  doc,
  template,
  id = 'permit-barang-paper-doc',
  previewPageFilter = 'all',
}) => {
  const companyName = (doc.companyName || template?.companyName || 'PT JEMBATAN DATA PANGRANGO')
    .replace(/\s+Jl\.?$/i, '')
    .trim();
  const displayCompanyName = companyName.toLowerCase().includes('jembatan data pangrango')
    ? 'PT. Jembatan Data Pangrango'
    : companyName;

  const companyAddress =
    doc.companyAddress ||
    template?.companyAddress ||
    'Jl. Arca No. 07, Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123';
  const companyPhone = doc.companyPhone || template?.companyPhone || '+62 857-9870-8612';
  const companyEmail = doc.companyEmail || template?.companyEmail || 'admin@jembatandata.com';

  const letterLocation = doc.letterLocation || template?.letterLocation || 'Sukabumi';
  const headerDateText = formatPermitBarangHeaderDate(letterLocation, doc.createdDate || new Date());
  const executionDateText = formatPermitBarangDate(doc.permitDate || doc.createdDate || new Date());

  const signerName = doc.signerName || template?.signerName || 'Rio Prayoga';
  const signerPosition = doc.signerPosition || template?.signerPosition || 'Direktur';

  const subject = doc.subject || (doc.permitType === 'masuk' ? 'Permit Masuk Barang' : 'Permit Keluar Barang');
  const isMasuk =
    doc.permitType === 'masuk' ||
    Boolean(subject && subject.toLowerCase().includes('masuk'));
  const actionText = isMasuk
    ? 'memasukkan'
    : doc.permitType === 'keluar'
    ? 'mengeluarkan'
    : 'mengeluarkan / memasukkan';

  const renderFormattedText = (text: string) => {
    if (text.includes('**')) {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    }
    const pattern = new RegExp(`(${subject}|mengeluarkan perangkat|memasukkan perangkat)`, 'gi');
    if (pattern.test(text)) {
      const parts = text.split(pattern);
      return parts.map((part, i) => {
        if (pattern.test(part)) {
          return <strong key={i}>{part}</strong>;
        }
        return part;
      });
    }
    return text;
  };

  const hasCustomBackground = Boolean(template?.letterheadBackgroundUrl);
  const hasCustomHeader = Boolean(template?.headerImageUrl);
  const defaultSpacer = hasCustomBackground ? 26 : 3;
  const spacerHeight =
    typeof template?.headerSpacerHeight === 'number'
      ? template.headerSpacerHeight
      : defaultSpacer;

  // Pagination calculation:
  // Focus: 1 single page as long as content fits and signature doesn't touch the bottom footer.
  // Up to 10 devices comfortably fit on 1 page before requiring Page 2.
  const allDevices = doc.devices || [];
  const isMultiPage = isPermitBarangMultiPage(doc);

  const page1MaxDevices = 8;
  const page1Devices = isMultiPage ? allDevices.slice(0, page1MaxDevices) : allDevices;
  const page2Devices = isMultiPage ? allDevices.slice(page1MaxDevices) : [];

  const showPage1 = previewPageFilter === 'all' || previewPageFilter === 1;
  const showPage2 = isMultiPage && (previewPageFilter === 'all' || previewPageFilter === 2);

  /**
   * Reusable Header Component for Page 1 and Page 2
   * Ensures content on any page is safely placed below the Kop Surat and never collides.
   */
  const renderHeader = (_pageNumber = 1) => {
    if (hasCustomBackground) {
      return (
        <div
          className="w-full shrink-0 transition-all duration-150"
          style={{ height: `${spacerHeight}mm` }}
        />
      );
    }

    if (hasCustomHeader) {
      return (
        <div
          className="w-full pb-0 select-none overflow-hidden transition-all duration-150"
          style={{ marginBottom: `${spacerHeight}mm` }}
        >
          <img
            src={template?.headerImageUrl}
            alt="Kop Surat Perusahaan"
            crossOrigin="anonymous"
            className="w-full h-auto object-contain max-h-[140px] block mx-auto"
          />
        </div>
      );
    }

    return (
      <div className="w-full pb-0 select-none">
        <div className="flex items-center gap-3.5">
          {/* Logo JDP */}
          <div className="flex items-center gap-2.5 shrink-0">
            {template?.logoUrl ? (
              <img
                src={template.logoUrl}
                alt="Logo Perusahaan"
                crossOrigin="anonymous"
                className="max-h-12 max-w-28 object-contain"
              />
            ) : (
              <div className="flex items-center">
                <svg
                  className="w-24 h-11"
                  viewBox="0 0 160 65"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g id="jdp-emblem">
                    <path
                      d="M24 6L6 38L15 54L22 42L18 35L30 14L40 14L28 35L35 35L42 22L32 6H24Z"
                      fill="#38BDF8"
                    />
                    <path
                      d="M48 18L38 35L45 47L52 35L57 44L47 61L39 47L32 47L44 68H56L62 58L55 46L65 29L48 18Z"
                      fill="#0284C7"
                    />
                    <path
                      d="M17 56L24 68H42L35 56H25L32 44L25 44L17 56Z"
                      fill="#0EA5E9"
                    />
                  </g>
                  <text
                    x="68"
                    y="49"
                    fontFamily="'Calibri', 'Segoe UI', Arial, sans-serif"
                    fontWeight="800"
                    fontSize="44"
                    fill="#5A8BB5"
                    letterSpacing="-0.5"
                  >
                    JDP
                  </text>
                </svg>
              </div>
            )}
          </div>

          {/* Company Title & Contacts */}
          <div className="flex-1">
            <h1
              className="text-[17px] font-bold tracking-wider text-slate-800 uppercase leading-tight"
              style={{ fontFamily: "'Calibri', 'Carlito', sans-serif", letterSpacing: '0.03em' }}
            >
              {companyName}
            </h1>
            <p className="text-[10.5px] text-slate-700 leading-snug mt-0.5">
              {companyAddress}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 text-[10.5px] text-slate-700 leading-snug">
              <span>
                <span className="font-semibold text-slate-800">Telp :</span> {companyPhone}
              </span>
              <span>
                <span className="font-semibold text-slate-800">Email :</span>{' '}
                <span className="text-blue-600 underline">{companyEmail}</span>
              </span>
              {template?.companyWebsite && (
                <span>
                  <span className="font-semibold text-slate-800">Web :</span> {template.companyWebsite}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Official Header Divider Bar */}
        <div
          className="mt-2 transition-all duration-150"
          style={{ marginBottom: `${spacerHeight}mm` }}
        >
          <div className="w-full h-[2px] bg-slate-900"></div>
          <div className="w-full h-[1px] bg-slate-900 mt-[1.5px]"></div>
        </div>
      </div>
    );
  };

  /**
   * Watermark and Wave Decor
   */
  const renderWave = () => (
    <div
      className="absolute top-0 right-0 pointer-events-none select-none z-0"
      style={{ width: '260px', height: '130px' }}
    >
      <svg
        viewBox="0 0 280 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="waveGradPrimaryPB" x1="20%" y1="0%" x2="100%" y2="90%">
            <stop offset="0%" stopColor="#6C7089" stopOpacity="0.88" />
            <stop offset="45%" stopColor="#829BB8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9FB7D2" stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id="waveGradSecondaryPB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#535873" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#7B99B7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#A8C2DE" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M10 0 C60 2, 110 25, 160 55 C210 85, 245 105, 280 108 L280 0 Z"
          fill="url(#waveGradSecondaryPB)"
        />
        <path
          d="M35 0 C85 0, 135 20, 180 48 C225 76, 255 86, 280 86 L280 0 Z"
          fill="url(#waveGradPrimaryPB)"
        />
      </svg>
    </div>
  );

  const renderWatermark = () => (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
      style={{ opacity: 0.09 }}
    >
      <div
        className="flex items-center gap-6 whitespace-nowrap transform -rotate-45"
        style={{ transform: 'rotate(-45deg) scale(1.15)' }}
      >
        <svg
          className="w-20 h-20 shrink-0"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M38 10L10 60L24 84L36 65L30 54L48 22L64 22L45 54L56 54L67 34L51 10H38Z"
            fill="#0284C7"
          />
          <path
            d="M76 29L60 55L71 74L82 55L90 69L75 95L62 74L51 74L70 106H89L98 90L87 71L103 45L76 29Z"
            fill="#0EA5E9"
          />
          <path
            d="M27 88L38 106H67L56 88H40L51 69L40 69L27 88Z"
            fill="#38BDF8"
          />
        </svg>
        <span
          className="text-[36px] font-extrabold tracking-wider text-sky-600 uppercase"
          style={{
            fontFamily: "'Calibri', 'Carlito', Arial, sans-serif",
            letterSpacing: '0.08em',
          }}
        >
          {companyName}
        </span>
      </div>
    </div>
  );

  /**
   * Reusable Closing Paragraphs Component
   */
  const renderClosingParagraphs = () => (
    <div className="text-[12px] leading-normal text-slate-900 my-2 space-y-1.5 text-justify">
      {doc.closingText ? (
        doc.closingText.split('\n\n').map((para, idx) => (
          <p key={idx}>{para}</p>
        ))
      ) : (
        <>
          <p>
            Demikian permohonan ini kami ajukan, kami berharap agar permohonan ini dapat segera diproses, saya siap memberikan informasi tambahan yang mungkin diperlukan terkait dengan permohonan ini.
          </p>
          <p>
            Atas perhatian dan kerjasama yang diberikan, kami ucapkan terima kasih.
          </p>
        </>
      )}
    </div>
  );

  /**
   * Reusable Signature Component
   */
  const renderSignature = () => (
    <div className="signature-section mt-3 break-inside-avoid">
      <p className="text-[12px] text-slate-900 mb-0.5">
        Hormat kami,
      </p>

      {/* Stamp & Signature area */}
      <div className="relative h-[62px] w-52 my-0.5 select-none">
        {/* Company Stamp */}
        {template?.stampImageUrl ? (
          <img
            src={template.stampImageUrl}
            alt="Cap Perusahaan"
            crossOrigin="anonymous"
            className="absolute object-contain pointer-events-none select-none"
            style={{
              left: '42px',
              top: '4px',
              height: '54px',
              maxWidth: '125px',
              mixBlendMode: 'multiply',
              transform: 'rotate(-2deg)',
            }}
          />
        ) : (
          <div
            className="absolute select-none pointer-events-none"
            style={{
              left: '42px',
              top: '4px',
              width: '125px',
              height: '52px',
              transform: 'rotate(-2deg)',
              mixBlendMode: 'multiply',
            }}
          >
            <svg
              viewBox="0 0 185 75"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M36 10 L10 38 L36 66 L46 56 L28 38 L46 20 Z"
                fill="#1e40af"
              />
              <path
                d="M48 20 L32 38 L48 56 L56 48 L44 38 L56 28 Z"
                fill="#1d4ed8"
              />
              <text
                x="57"
                y="52"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="900"
                fontSize="42"
                fill="#1e40af"
                letterSpacing="-1"
              >
                JDP
              </text>
              <text
                x="8"
                y="71"
                fontFamily="system-ui, -apple-system, sans-serif"
                fontWeight="800"
                fontSize="10"
                fill="#1e40af"
                letterSpacing="0.6"
              >
                PT JEMBATAN DATA PANGRANGO
              </text>
            </svg>
          </div>
        )}

        {/* Handwritten Signature if uploaded */}
        {template?.signatureImageUrl ? (
          <img
            src={template.signatureImageUrl}
            alt="Tanda Tangan"
            crossOrigin="anonymous"
            className="absolute object-contain pointer-events-none select-none z-10"
            style={{
              left: '0px',
              top: '0px',
              height: '62px',
              maxWidth: '140px',
              mixBlendMode: 'multiply',
            }}
          />
        ) : null}
      </div>

      {/* Signer Name & Position */}
      <div className="mt-0.5">
        <p
          className="font-bold text-[13px] text-slate-900 underline underline-offset-2 leading-tight"
          style={{ letterSpacing: '0.02em' }}
        >
          {signerName}
        </p>
        <p className="text-[12px] text-slate-700 leading-tight mt-0.5">
          {signerPosition}
        </p>
      </div>
    </div>
  );

  return (
    <div id={id} className="permit-barang-document-wrapper w-full flex flex-col items-center">
      {/* ================= PAGE 1 ================= */}
      {showPage1 && (
        <div
          id={`${id}-page-1`}
          data-page-index="1"
          className="permit-barang-page relative bg-white text-slate-900 mx-auto w-full flex flex-col overflow-hidden shadow-2xl print:shadow-none mb-8 print:mb-0 print:break-after-page"
          style={{
            width: '100%',
            maxWidth: '210mm',
            minHeight: '297mm',
            height: '297mm',
            padding: hasCustomBackground ? '10mm 18mm 12mm 18mm' : '12mm 18mm 12mm 18mm',
            fontFamily: "'Calibri', 'Carlito', 'Candara', 'Segoe UI', Arial, sans-serif",
            boxSizing: 'border-box',
            color: '#1a1a1a',
            pageBreakAfter: isMultiPage ? 'always' : 'auto',
            breakAfter: isMultiPage ? 'page' : 'auto',
            ...(hasCustomBackground
              ? {
                  backgroundImage: `url(${template?.letterheadBackgroundUrl})`,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                }
              : {}),
          }}
        >
          {/* Full-bleed letterhead background if uploaded */}
          {hasCustomBackground && (
            <img
              src={template?.letterheadBackgroundUrl}
              alt="Kop Surat"
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
            />
          )}

          {!hasCustomBackground && !hasCustomHeader && renderWave()}
          {!hasCustomBackground && renderWatermark()}

          {/* Main Content Area Page 1 */}
          <div className="relative z-10 flex-1 flex flex-col">
            {/* Kop Surat */}
            {renderHeader(1)}

            {/* Tanggal di Pojok Kanan */}
            <div className="text-right text-[12px] text-slate-900 mt-0.5 mb-1.5 font-normal">
              {headerDateText}
            </div>

            {/* Perihal */}
            <div className="text-[12px] text-slate-900 mb-2 font-normal">
              <span>Perihal: </span>
              <span className="font-semibold text-slate-900">{subject}</span>
            </div>

            {/* Kepada Yth */}
            <div className="text-[12px] leading-snug text-slate-900 mb-2 space-y-0.5">
              <p>Kepada Yth.</p>
              <p className="font-semibold">{doc.recipientTitle || 'Pihak Gedung / Security Wisma Bumi Putera'}</p>
              {doc.recipientAddress && <p>{doc.recipientAddress}</p>}
              {doc.recipientCity && <p>{doc.recipientCity}</p>}
            </div>

            {/* Salam Pembuka & Identitas Pemohon */}
            <div className="text-[12px] leading-snug text-slate-900 mb-1 space-y-0.5">
              <p>Dengan hormat,</p>
              <p>Saya yang bertandatangan di bawah ini:</p>
            </div>

            <div className="ml-5 my-1 text-[12px] space-y-0.5">
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Nama</span>
                <span className="mr-2">:</span>
                <span className="font-semibold text-slate-900">{doc.applicantName || '-'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Jabatan</span>
                <span className="mr-2">:</span>
                <span className="text-slate-800">{doc.applicantPosition || 'PIC'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Nomor Telepon</span>
                <span className="mr-2">:</span>
                <span className="text-slate-800">{doc.applicantPhone || '-'}</span>
              </div>
            </div>

            {/* Kalimat Permohonan / Opening Text */}
            <div className="text-[12px] leading-normal text-slate-900 my-1.5 space-y-1 text-justify">
              {doc.openingText ? (
                doc.openingText.split('\n').map((line, idx) => (
                  <p key={idx}>{renderFormattedText(line)}</p>
                ))
              ) : (
                <>
                  <p>
                    Sebagai perwakilan dari {displayCompanyName}, dengan ini saya mengajukan permohonan <strong>{subject}</strong> untuk melakukan beberapa keperluan.
                  </p>
                  <p>
                    Dengan ini kami sampaikan permohonan izin <strong>{actionText} perangkat</strong> kami Dengan spesifikasi yang terlampir dibawah ini :
                  </p>
                </>
              )}
            </div>

            {/* Detail Spesifikasi Permit */}
            <div className="ml-5 my-1.5 text-[12px] space-y-1">
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Waktu</span>
                <span className="mr-2">:</span>
                <span className="text-slate-900 font-medium">{executionDateText}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Pukul</span>
                <span className="mr-2">:</span>
                <span className="text-slate-800">{doc.permitTime || '09.00 s.d 15.00'}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Aktifitas</span>
                <span className="mr-2">:</span>
                <span className="text-slate-900 font-medium">{doc.activity || subject}</span>
              </div>
              <div className="flex items-baseline">
                <span className="w-32 shrink-0 text-slate-800">Lokasi</span>
                <span className="mr-2">:</span>
                <span className="text-slate-900">{doc.location || '-'}</span>
              </div>
              <div className="flex items-start pt-0.5">
                <span className="w-32 shrink-0 text-slate-800 pt-0.5">Jenis Perangkat</span>
                <span className="mr-2 pt-0.5">:</span>
                <div className="flex-1 space-y-0.5">
                  {page1Devices.length > 0 ? (
                    page1Devices.map((device, idx) => (
                      <div key={device.id || idx} className="leading-snug text-slate-900 flex items-baseline gap-1.5">
                        <span className="text-slate-500 font-mono text-[11px]">{idx + 1}.</span>
                        <span className="font-medium text-slate-900">{device.name}</span>
                        {device.quantity && (
                          <span className="text-slate-600 text-[11px] font-medium">({device.quantity})</span>
                        )}
                        {device.serialNumber && (
                          <span className="text-slate-500 font-mono text-[11px]">[SN: {device.serialNumber}]</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Belum ada perangkat ditambahkan</span>
                  )}
                </div>
              </div>
            </div>

            {/* If Single-Page document: Closing & Signature sit on Page 1 */}
            {!isMultiPage && (
              <>
                {renderClosingParagraphs()}
                {renderSignature()}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= PAGE 2 (LEMBAR BARU) ================= */}
      {isMultiPage && showPage2 && (
        <div
          id={`${id}-page-2`}
          data-page-index="2"
          className="permit-barang-page relative bg-white text-slate-900 mx-auto w-full flex flex-col overflow-hidden shadow-2xl print:shadow-none mb-8 print:mb-0"
          style={{
            width: '100%',
            maxWidth: '210mm',
            minHeight: '297mm',
            height: '297mm',
            padding: hasCustomBackground ? '10mm 18mm 12mm 18mm' : '12mm 18mm 12mm 18mm',
            fontFamily: "'Calibri', 'Carlito', 'Candara', 'Segoe UI', Arial, sans-serif",
            boxSizing: 'border-box',
            color: '#1a1a1a',
            pageBreakAfter: 'auto',
            breakAfter: 'auto',
            ...(hasCustomBackground
              ? {
                  backgroundImage: `url(${template?.letterheadBackgroundUrl})`,
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                }
              : {}),
          }}
        >
          {hasCustomBackground && (
            <img
              src={template?.letterheadBackgroundUrl}
              alt="Kop Surat"
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
            />
          )}

          {!hasCustomBackground && !hasCustomHeader && renderWave()}
          {!hasCustomBackground && renderWatermark()}

          <div className="relative z-10 flex-1 flex flex-col">
            {/* Header Kop Surat on Page 2 (Guarantees safe clearance below the Kop Surat) */}
            {renderHeader(2)}

            {/* Continuation of devices */}
            {page2Devices.length > 0 && (
              <div className="ml-5 my-2 text-[12px] space-y-1">
                <div className="flex items-start">
                  <span className="w-32 shrink-0 text-slate-800 pt-0.5">Jenis Perangkat</span>
                  <span className="mr-2 pt-0.5">:</span>
                  <div className="flex-1 space-y-1">
                    {page2Devices.map((device, idx) => (
                      <div key={device.id || idx} className="leading-snug text-slate-900 flex items-baseline gap-1.5">
                        <span className="text-slate-500 font-mono text-[11px]">{page1Devices.length + idx + 1}.</span>
                        <span className="font-medium text-slate-900">{device.name}</span>
                        {device.quantity && (
                          <span className="text-slate-600 text-[11px] font-medium">({device.quantity})</span>
                        )}
                        {device.serialNumber && (
                          <span className="text-slate-500 font-mono text-[11px]">[SN: {device.serialNumber}]</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Kalimat Penutup */}
            {renderClosingParagraphs()}

            {/* Tanda Tangan Block */}
            {renderSignature()}
          </div>
        </div>
      )}
    </div>
  );
};
