import React from 'react';
import type { SuratTugasDocument, SuratTugasTemplate } from '@/types/suratTugas';
import { DEFAULT_SURAT_TUGAS_OPENING_TEXT } from '@/types/suratTugas';
import type { RFOTemplate } from '@/types/rfo';
import {
  formatIndonesianDate,
  formatSuratTugasIntroDate,
  formatSuratTugasExecutionDate,
} from '@/utils/suratTugasUtils';

interface SuratTugasPaperDocumentProps {
  doc: Partial<SuratTugasDocument>;
  template?: SuratTugasTemplate | RFOTemplate;
  id?: string;
}

export const SuratTugasPaperDocument: React.FC<SuratTugasPaperDocumentProps> = ({
  doc,
  template,
  id = 'surat-tugas-paper-doc',
}) => {
  const introDateText = formatSuratTugasIntroDate(doc.startDate || '', doc.endDate || '');
  const executionDateText = formatSuratTugasExecutionDate(doc.startDate || '', doc.endDate || '');
  const letterDateFormatted = formatIndonesianDate(doc.createdDate || new Date());
  const location = doc.letterLocation || template?.letterLocation || 'Sukabumi';

  // Company info from document or template with Gunungpuyuh default as in official reference
  const companyName = (doc.companyName || template?.companyName || 'PT JEMBATAN DATA PANGRANGO')
    .replace(/\s+Jl\.?$/i, '')
    .trim();
  const companyAddress =
    doc.companyAddress ||
    template?.companyAddress ||
    'Jl. Arca No. 07, Kel/Kec. Gunungpuyuh, Kota Sukabumi, Jawa Barat 43123';
  const companyPhone = doc.companyPhone || template?.companyPhone || '+62 857-9870-8612';
  const companyEmail = doc.companyEmail || template?.companyEmail || 'admin@jembatandata.com';
  const companyWebsite = doc.companyWebsite || template?.companyWebsite || 'Sukabuminetwork.net';

  const signerName = doc.signerName || template?.signerName || 'Nandar Munandar';
  const signerPosition = doc.signerPosition || template?.signerPosition || 'Direktur';

  const rawOpeningTemplate =
    doc.openingText ||
    (template && 'defaultOpeningText' in template && template.defaultOpeningText) ||
    DEFAULT_SURAT_TUGAS_OPENING_TEXT;

  const closingText =
    doc.closingText ||
    (template && 'defaultClosingText' in template && template.defaultClosingText) ||
    'Demikian surat tugas ini diterbitkan dengan sebenar-benarnya. Pihak bersangkutan diharapkan mampu melaksanakan dengan penuh tanggung jawab.';

  const renderOpeningParagraph = (text: string) => {
    const parts = text.split(/(\{tanggal\}|\{date\}|\{lokasi\}|\{location\})/gi);
    return parts.map((part, index) => {
      const lower = part.toLowerCase();
      if (lower === '{tanggal}' || lower === '{date}') {
        return <span key={index}>{introDateText}</span>;
      }
      if (lower === '{lokasi}' || lower === '{location}') {
        return (
          <span key={index} className="font-medium text-slate-900">
            {doc.visitLocation ? doc.visitLocation.toLowerCase() : 'data center'}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const hasCustomBackground = Boolean(template?.letterheadBackgroundUrl);
  const hasCustomHeader = Boolean(template?.headerImageUrl);
  const defaultSpacer = hasCustomBackground ? 38 : 6;
  const spacerHeight =
    typeof template?.headerSpacerHeight === 'number'
      ? template.headerSpacerHeight
      : defaultSpacer;

  return (
    <div
      id={id}
      className="surat-tugas-container relative bg-white text-slate-900 mx-auto w-full transition-all flex flex-col justify-between overflow-hidden shadow-2xl"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        padding: '16mm 20mm',
        fontFamily: "'Calibri', 'Carlito', 'Candara', 'Segoe UI', Arial, sans-serif",
        boxSizing: 'border-box',
        color: '#1a1a1a',
        ...(hasCustomBackground
          ? {
              backgroundImage: `url(${template?.letterheadBackgroundUrl})`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }
          : {}),
      }}
    >
      {/* Full-bleed letterhead background (real img tag ensures 100% reliable print & PDF) */}
      {hasCustomBackground && (
        <img
          src={template?.letterheadBackgroundUrl}
          alt="Kop Surat"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
        />
      )}

      {/* 0. Faint Diagonal Watermark */}
      {!hasCustomBackground && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
          style={{ opacity: 0.11 }}
        >
          <div
            className="flex items-center gap-6 whitespace-nowrap"
            style={{ transform: 'rotate(-45deg) scale(1.2)' }}
          >
            {/* Watermark Emblem */}
            <svg
              className="w-24 h-24 shrink-0"
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
              className="text-[42px] font-extrabold tracking-wider text-sky-600 uppercase"
              style={{
                fontFamily: "'Calibri', 'Carlito', Arial, sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              {companyName}
            </span>
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* 1. Header / Kop Surat */}
        {hasCustomBackground ? (
          <div
            className="w-full shrink-0 transition-all duration-150"
            style={{ height: `${spacerHeight}mm` }}
          />
        ) : hasCustomHeader ? (
          <div
            className="w-full pb-0 select-none overflow-hidden transition-all duration-150"
            style={{ marginBottom: `${spacerHeight}mm` }}
          >
            <img
              src={template?.headerImageUrl}
              alt="Kop Surat Perusahaan"
              crossOrigin="anonymous"
              className="w-full h-auto object-contain max-h-[160px] block mx-auto"
            />
          </div>
        ) : (
          <div className="w-full pb-0 select-none">
            <div className="flex items-center gap-4">
              {/* JDP Triangle Emblem + JDP Text Logo */}
              <div className="flex items-center gap-3 shrink-0">
                {template?.logoUrl ? (
                  <img
                    src={template.logoUrl}
                    alt="Logo Perusahaan"
                    crossOrigin="anonymous"
                    className="max-h-14 max-w-32 object-contain"
                  />
                ) : (
                  <div className="flex items-center">
                    <svg
                      className="w-28 h-12"
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

              {/* Company Title */}
              <div className="flex-1">
                <h1
                  className="text-[20px] font-bold tracking-wider text-slate-800 uppercase"
                  style={{ fontFamily: "'Calibri', 'Carlito', sans-serif", letterSpacing: '0.04em' }}
                >
                  {companyName}
                </h1>
                <p className="text-[11px] text-slate-700 leading-snug mt-0.5">
                  {companyAddress}
                </p>
                <p className="text-[11px] text-slate-700 leading-snug">
                  <span className="font-semibold text-slate-800">Telp :</span> {companyPhone}
                </p>
                <p className="text-[11px] text-slate-700 leading-snug">
                  <span className="font-semibold text-slate-800">Email : </span>
                  <span className="text-blue-600 underline">{companyEmail}</span>
                  <span className="mx-2 text-slate-400">Web : </span>
                  <span className="text-blue-600 underline">{companyWebsite}</span>
                </p>
              </div>
            </div>

            {/* Official Header Double Divider Bar */}
            <div
              className="mt-2.5 transition-all duration-150"
              style={{ marginBottom: `${spacerHeight}mm` }}
            >
              <div className="w-full h-[2.5px] bg-slate-900"></div>
              <div className="w-full h-[1px] bg-slate-900 mt-[2px]"></div>
            </div>
          </div>
        )}

        {/* 2. Document Title & Official Number */}
        <div className="text-center my-4">
          <h2
            className="text-[17px] font-extrabold tracking-wider text-slate-900 uppercase underline decoration-2 underline-offset-4"
            style={{ letterSpacing: '0.06em' }}
          >
            SURAT TUGAS
          </h2>
          <p className="text-[13.5px] font-bold text-slate-900 mt-1 tracking-wide">
            Nomor : {doc.letterNumber || 'ST/120/IX/2026/JDP'}
          </p>
        </div>

        {/* 3. Opening Paragraph */}
        <div className="text-[13.5px] leading-[1.8] text-slate-900 text-justify mt-5 mb-4">
          {rawOpeningTemplate.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ textIndent: '38px' }} className={i > 0 ? 'mt-2' : ''}>
              {renderOpeningParagraph(para)}
            </p>
          ))}
        </div>

        {/* 4. Numbered Details List */}
        <div className="text-[13.5px] text-slate-900 space-y-2.5 my-3 pl-3">
          {/* Row 1: Tanggal Pelaksanaan */}
          <div className="flex items-start">
            <span className="w-6 shrink-0 font-medium text-slate-800">1.</span>
            <span className="w-44 shrink-0 font-medium text-slate-800">Tanggal Pelaksanaan</span>
            <span className="mr-2.5 text-slate-800">:</span>
            <span className="flex-1 text-slate-900">{executionDateText}</span>
          </div>

          {/* Row 2: Lokasi Visit */}
          <div className="flex items-start">
            <span className="w-6 shrink-0 font-medium text-slate-800">2.</span>
            <span className="w-44 shrink-0 font-medium text-slate-800">Lokasi Visit</span>
            <span className="mr-2.5 text-slate-800">:</span>
            <span className="flex-1 text-slate-900">{doc.visitLocation || '-'}</span>
          </div>

          {/* Row 3: Nama dan No Telp */}
          <div className="flex items-start">
            <span className="w-6 shrink-0 font-medium text-slate-800">3.</span>
            <span className="w-44 shrink-0 font-medium text-slate-800">Nama dan No Telp</span>
            <span className="mr-2.5 text-slate-800">:</span>
            <div className="flex-1 text-slate-900">
              {!doc.personnel || doc.personnel.length === 0 ? (
                <span className="text-slate-400 italic">[Belum ada personil]</span>
              ) : doc.personnel.length === 1 ? (
                <span>
                  {doc.personnel[0].name} ({doc.personnel[0].phone})
                </span>
              ) : (
                <div className="space-y-1">
                  {doc.personnel.map((person, idx) => (
                    <div key={person.id || idx} className="flex items-center gap-1.5">
                      <span className="text-slate-700 font-medium">{idx + 1}.</span>
                      <span>
                        {person.name} ({person.phone})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. Closing Paragraph */}
        <div className="text-[13.5px] leading-[1.8] text-slate-900 text-justify mt-5 mb-7 space-y-2">
          {closingText.split('\n').filter(Boolean).map((para, i) => (
            <p key={i} style={{ textIndent: '38px' }}>
              {para}
            </p>
          ))}
        </div>

        {/* 6. Date, Salutation & Signature Block */}
        <div className="mt-2 break-inside-avoid w-72">
          <p className="text-[13.5px] text-slate-800 leading-snug">
            {location}, {letterDateFormatted}
          </p>
          <p className="text-[13.5px] text-slate-800 leading-snug">Hormat Kami,</p>
          <p className="text-[13.5px] font-bold text-slate-900 leading-snug mb-2">
            {companyName}
          </p>

          {/* Signature & Stamp Overlay Area */}
          <div className="relative h-[72px] w-56 my-1 select-none">
            {/* 1. Official JDP Stamp */}
            {doc.stampImageUrl || template?.stampImageUrl ? (
              <img
                src={doc.stampImageUrl || template?.stampImageUrl}
                alt="Cap Perusahaan"
                crossOrigin="anonymous"
                className="absolute object-contain pointer-events-none select-none"
                style={{
                  left: '50px',
                  top: '2px',
                  height: '64px',
                  maxWidth: '135px',
                  mixBlendMode: 'multiply',
                  transform: 'rotate(-2deg)',
                }}
              />
            ) : (
              <div
                className="absolute select-none pointer-events-none"
                style={{
                  left: '50px',
                  top: '2px',
                  width: '135px',
                  height: '62px',
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
                  <path d="M36 10 L10 38 L36 66 L46 56 L28 38 L46 20 Z" fill="#1e40af" />
                  <path d="M48 20 L32 38 L48 56 L56 48 L44 38 L56 28 Z" fill="#1d4ed8" />
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

            {/* 2. Handwritten Signature */}
            {doc.signatureImageUrl || template?.signatureImageUrl ? (
              <img
                src={doc.signatureImageUrl || template?.signatureImageUrl}
                alt="Tanda Tangan"
                crossOrigin="anonymous"
                className="absolute object-contain pointer-events-none select-none z-10"
                style={{
                  left: '0px',
                  top: '0px',
                  height: '70px',
                  maxWidth: '150px',
                  mixBlendMode: 'multiply',
                }}
              />
            ) : (
              <div
                className="absolute select-none pointer-events-none z-10"
                style={{
                  left: '0px',
                  top: '0px',
                  width: '150px',
                  height: '70px',
                  mixBlendMode: 'multiply',
                }}
              >
                {/* Cursive Signature Vector matching reference */}
                <svg
                  className="w-full h-full"
                  viewBox="0 0 220 85"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 64 C 20 48, 24 22, 30 14 C 36 6, 50 8, 48 24 C 46 38, 26 42, 22 56 C 20 64, 34 62, 46 58 C 58 54, 76 42, 88 44 C 98 46, 92 60, 106 50 C 118 42, 132 40, 145 46 C 158 52, 168 44, 185 40 C 198 38, 210 40, 218 36"
                    stroke="#18181b"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 36 L 80 33"
                    stroke="#18181b"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 3. Signer Name & Position */}
          <div className="mt-1">
            <p className="text-[14.5px] font-bold text-slate-900 leading-tight">
              {signerName}
            </p>
            <p className="text-[13px] text-slate-700 leading-tight">
              {signerPosition}
            </p>
          </div>
        </div>
      </div>

      {/* 7. Bottom Footer */}
      {!hasCustomBackground && (
        <div
          className="relative z-10 mt-auto pt-6 border-t border-slate-300/80 text-[10.5px] leading-snug text-slate-700 select-none"
          style={{ fontFamily: "'Calibri', 'Carlito', sans-serif" }}
        >
          <p className="font-bold text-slate-900 uppercase tracking-wide">{companyName}</p>
          <p>
            {companyAddress} <span className="font-semibold text-slate-800">Telp :</span>{' '}
            {companyPhone}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Email : </span>
            <span className="text-blue-600 underline">{companyEmail}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span className="font-semibold text-slate-800">Web : </span>
            <span className="text-blue-600 underline">{companyWebsite}</span>
          </p>
        </div>
      )}
    </div>
  );
};
