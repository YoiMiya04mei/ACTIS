import React from 'react';
import type { RFOTemplate } from '@/types/rfo';

interface CompanyHeaderProps {
  template: RFOTemplate;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({ template }) => {
  // If user uploaded a full A4 letterhead background (PDF or full-page scan)
  if (template.letterheadBackgroundUrl) {
    const spacerHeight = template.headerSpacerHeight !== undefined ? template.headerSpacerHeight : 4;
    return (
      <div
        className="company-header-spacer w-full shrink-0 transition-all"
        style={{ height: `${spacerHeight}mm` }}
      />
    );
  }

  // If user uploaded a full letterhead banner image
  if (template.headerImageUrl) {
    const offsetY = template.headerSpacerHeight !== undefined ? template.headerSpacerHeight - 4 : 0;
    return (
      <div
        className="company-header w-full pb-0 mb-0 select-none overflow-hidden transition-all"
        style={{
          marginBottom: offsetY !== 0 ? `${offsetY}mm` : undefined,
        }}
      >
        <img
          src={template.headerImageUrl}
          alt="Kop Surat Perusahaan"
          crossOrigin="anonymous"
          className="w-full h-auto object-contain max-h-[160px] block mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="company-header w-full pb-0 select-none">
      <div className="flex items-center gap-4">
        {/* Company Logo: Custom uploaded or JDP Vector */}
        <div className="flex items-center gap-3 shrink-0">
          {template.logoUrl ? (
            <img
              src={template.logoUrl}
              alt="Logo Perusahaan"
              crossOrigin="anonymous"
              className="max-h-14 max-w-32 object-contain"
            />
          ) : (
            <div className="flex items-center">
              {/* JDP Triangle Emblem + JDP Text Logo */}
              <svg
                className="w-28 h-12"
                viewBox="0 0 160 65"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* 3-Chevron Interlocking Triangle */}
                <g id="jdp-emblem">
                  {/* Left Arm */}
                  <path
                    d="M24 6L6 38L15 54L22 42L18 35L30 14L40 14L28 35L35 35L42 22L32 6H24Z"
                    fill="#38BDF8"
                  />
                  {/* Right Arm */}
                  <path
                    d="M48 18L38 35L45 47L52 35L57 44L47 61L39 47L32 47L44 68H56L62 58L55 46L65 29L48 18Z"
                    fill="#0284C7"
                  />
                  {/* Bottom Arm */}
                  <path
                    d="M17 56L24 68H42L35 56H25L32 44L25 44L17 56Z"
                    fill="#0EA5E9"
                  />
                </g>
                {/* JDP Text */}
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
            {template.companyName}
          </h1>
        </div>
      </div>

      {/* Company Address and Contact Details (Centered / Block underneath as in Word) */}
      <div
        className="text-center text-[11px] leading-snug text-slate-700 mt-1 space-y-0.5"
        style={{ fontFamily: "'Calibri', 'Carlito', sans-serif" }}
      >
        <p className="tracking-normal">{template.companyAddress}</p>
        <p>
          <span className="font-semibold text-slate-800">Telp :</span>{' '}
          <span>{template.companyPhone}</span>
        </p>
        <p className="text-[11px]">
          <span className="font-semibold text-slate-800">Email : </span>
          <span className="text-blue-600 underline cursor-pointer">
            {template.companyEmail}
          </span>
          <span className="mx-2 text-slate-400">|</span>
          <span className="font-semibold text-slate-800">Web : </span>
          <span className="text-blue-600 underline cursor-pointer">
            {template.companyWebsite || 'Sukabuminetwork.net'}
          </span>
        </p>
      </div>

      {/* Official Header Double Divider Bar (Thick line over Thin line) */}
      <div
        className="mt-2 transition-all duration-150"
        style={{
          marginBottom: template.headerSpacerHeight !== undefined ? `${template.headerSpacerHeight}mm` : undefined,
        }}
      >
        <div className="w-full h-[2.5px] bg-slate-900"></div>
        <div className="w-full h-[1px] bg-slate-900 mt-[2px]"></div>
      </div>
    </div>
  );
};
