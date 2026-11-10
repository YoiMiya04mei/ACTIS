import React from 'react';
import type { RFODocument, RFOTemplate } from '@/types/rfo';
import { CompanyHeader } from './CompanyHeader';
import { SignatureBlock } from './SignatureBlock';
import {
  formatIndonesianDateTime,
  formatIndonesianLetterDate,
} from '@/utils/dateFormatter';

interface RFOPaperDocumentProps {
  rfo: Partial<RFODocument>;
  template: RFOTemplate;
  id?: string;
  isPrinting?: boolean;
}

export const RFOPaperDocument: React.FC<RFOPaperDocumentProps> = ({
  rfo,
  template,
  id = 'rfo-paper-doc',
}) => {
  const letterDate = formatIndonesianLetterDate(
    template.letterLocation || 'Sukabumi',
    rfo.rfoDate || new Date()
  );

  const startFormatted = rfo.startTime
    ? formatIndonesianDateTime(rfo.startTime)
    : '-';
  const endFormatted = rfo.endTime
    ? formatIndonesianDateTime(rfo.endTime)
    : '-';

  const durationFormatted = rfo.totalDuration || '-';

  // Description text with fallback
  const descriptionText =
    rfo.disruptionDescription && rfo.disruptionDescription.trim() !== ''
      ? rfo.disruptionDescription
      : template.defaultDescription ||
        'Selama waktu tersebut, layanan mengalami gangguan. Saat ini seluruh layanan telah kembali normal dan dapat digunakan seperti biasa.';

  const hasCustomKop = Boolean(template.letterheadBackgroundUrl || template.headerImageUrl);

  return (
    <div
      id={id}
      className="rfo-document-container relative bg-white text-slate-900 mx-auto w-full transition-all flex flex-col justify-between overflow-hidden"
      style={{
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        padding: '16mm 20mm',
        fontFamily: "'Calibri', 'Carlito', 'Candara', 'Segoe UI', Arial, sans-serif",
        boxSizing: 'border-box',
        color: '#1a1a1a',
        ...(template.letterheadBackgroundUrl
          ? {
              backgroundImage: `url(${template.letterheadBackgroundUrl})`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }
          : {}),
      }}
    >
      {/* Full-bleed letterhead background (real img tag ensures 100% reliable print & PDF) */}
      {template.letterheadBackgroundUrl && (
        <img
          src={template.letterheadBackgroundUrl}
          alt="Kop Surat"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none z-0"
        />
      )}

      {/* 0. Top-Right Corner Organic Decorative Wave (Only active for default template) */}
      {!hasCustomKop && template.showTopCornerWave !== false && (
        <div
          className="absolute top-0 right-0 pointer-events-none select-none z-0"
          style={{ width: '280px', height: '140px' }}
        >
          <svg
            viewBox="0 0 280 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="waveGradPrimary" x1="20%" y1="0%" x2="100%" y2="90%">
                <stop offset="0%" stopColor="#6C7089" stopOpacity="0.88" />
                <stop offset="45%" stopColor="#829BB8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#9FB7D2" stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id="waveGradSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#535873" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#7B99B7" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#A8C2DE" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {/* Secondary Soft Layer */}
            <path
              d="M10 0 C60 2, 110 25, 160 55 C210 85, 245 105, 280 108 L280 0 Z"
              fill="url(#waveGradSecondary)"
            />
            {/* Primary Gradient Curve */}
            <path
              d="M35 0 C85 0, 135 20, 180 48 C225 76, 255 86, 280 86 L280 0 Z"
              fill="url(#waveGradPrimary)"
            />
          </svg>
        </div>
      )}

      {/* Faint Diagonal Watermark across the document */}
      {!template.letterheadBackgroundUrl && template.showWatermark !== false && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
          style={{ opacity: 0.11 }}
        >
          <div
            className="flex items-center gap-6 whitespace-nowrap transform -rotate-45"
            style={{ transform: 'rotate(-45deg) scale(1.25)' }}
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
            {/* Watermark Text */}
            <span
              className="text-[44px] font-extrabold tracking-wider text-sky-600 uppercase"
              style={{
                fontFamily: "'Calibri', 'Carlito', Arial, sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              {template.watermarkText || template.companyName || 'PT. JEMBATAN DATA PANGRANGO'}
            </span>
          </div>
        </div>
      )}

      {/* Content wrapper with relative z-10 for crisp readability over watermark */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* 1. Header with Company Logo & Contact Details */}
        <CompanyHeader template={template} />

        {/* 2. Date Right Aligned */}
        <div className="text-right text-[13.5px] text-slate-800 mt-2 mb-2.5">
          {letterDate}
        </div>

      {/* 3. Salutation & Opening Paragraph */}
      <div className="mb-3 text-[13px] leading-relaxed text-slate-900 space-y-1.5">
        <p>{template.salutation || 'Pelanggan Yang Terhormat,'}</p>
        <p>
          {template.openingGreeting ||
            'Terima kasih atas kepercayaan Bapak/Ibu yang telah menggunakan layanan internet dari PT Jembatan Data Pangrango.'}
        </p>
        <p>
          {template.infoLead ||
            'Informasi berikut kami sampaikan terkait dengan gangguan yang telah terjadi:'}
        </p>
      </div>

      {/* 4. Table of Outage Information (Exact structure from reference document) */}
      <div className="mb-3 overflow-hidden">
        <table className="w-full border-collapse border border-slate-900 text-[13px]">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-900 px-3 py-2 text-left font-bold text-slate-900 w-[30%]">
                Informasi
              </th>
              <th className="border border-slate-900 px-3 py-2 text-left font-bold text-slate-900 w-[70%]">
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-900 px-3 py-2 font-medium text-slate-800 align-top">
                Waktu Mulai
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900 align-top">
                {startFormatted}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-3 py-2 font-medium text-slate-800 align-top">
                Waktu Selesai
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900 align-top">
                {endFormatted}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-3 py-2 font-medium text-slate-800 align-top">
                Total Durasi
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900 font-semibold align-top">
                {durationFormatted}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-3 py-2 font-medium text-slate-800 align-top">
                Root Cause
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900 align-top whitespace-pre-line leading-relaxed">
                {rfo.rootCause ? (
                  rfo.rootCause
                ) : (
                  <span className="text-slate-400 italic">[Belum diisi]</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-900 px-3 py-2 font-medium text-slate-800 align-top">
                Action Taken
              </td>
              <td className="border border-slate-900 px-3 py-2 text-slate-900 align-top whitespace-pre-line leading-relaxed">
                {rfo.actionTaken ? (
                  rfo.actionTaken
                ) : (
                  <span className="text-slate-400 italic">[Belum diisi]</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. Follow-up description & Customer Care closing */}
      <div className="mb-3 text-[13px] leading-relaxed text-slate-900 space-y-2">
        <p className="whitespace-pre-line">{descriptionText}</p>

        <p>
          {template.closingContact ||
            'Kami mengucapkan terima kasih atas kesabaran dan pengertian Bapak/Ibu. Apabila masih terdapat kendala layanan, jangan ragu untuk menghubungi Customer Service kami di:'}
        </p>

        <p className="font-bold text-slate-900 text-[13.5px]">
          {template.contactPhone || '+62 895-3182-5259'}
        </p>

        <div className="space-y-0.5">
          {template.closingRemarks.split('\n').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      </div>

      {/* 6. Signature Block */}
      <SignatureBlock template={template} />
      </div>

      {/* 7. Bottom Footer */}
      {template.letterheadBackgroundUrl ? (
        // When using full letterhead background, the footer is already printed on the page
        <div className="rfo-document-footer-spacer relative z-10 mt-auto h-[18mm] shrink-0" />
      ) : template.footerImageUrl ? (
        // When user uploaded a kop surat with footer image
        <div className="rfo-document-footer relative z-10 mt-auto pt-4 select-none">
          <img
            src={template.footerImageUrl}
            alt="Footer Kop Surat"
            crossOrigin="anonymous"
            className="w-full h-auto object-contain max-h-[75px] block mx-auto"
          />
        </div>
      ) : template.showFooter !== false ? (
        <div
          className="rfo-document-footer relative z-10 mt-auto pt-6 border-t border-slate-300/80 text-[10.5px] leading-snug text-slate-700 select-none"
          style={{ fontFamily: "'Calibri', 'Carlito', sans-serif" }}
        >
          <p className="font-bold text-slate-900 uppercase tracking-wide">
            {template.companyName}
          </p>
          <p>
            {template.companyAddress}{' '}
            <span className="font-semibold text-slate-800">Telp :</span>{' '}
            {template.companyPhone}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Email : </span>
            <span className="text-blue-600 underline">{template.companyEmail}</span>
            <span className="mx-2 text-slate-400">|</span>
            <span className="font-semibold text-slate-800">Web : </span>
            <span className="text-blue-600 underline">
              {template.companyWebsite || 'Sukabuminetwork.net'}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
};
