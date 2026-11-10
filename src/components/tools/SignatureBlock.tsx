import React from 'react';
import type { RFOTemplate } from '@/types/rfo';

interface SignatureBlockProps {
  template: RFOTemplate;
}

export const SignatureBlock: React.FC<SignatureBlockProps> = ({ template }) => {
  return (
    <div className="signature-block mt-2 break-inside-avoid">
      <p className="text-[13.5px] text-slate-800 mb-1">
        {template.signOff || 'Hormat Kami,'}
      </p>

      {/* Signature & Company Stamp Combined Area - scaled down to compact official proportions */}
      <div className="relative h-[68px] w-56 my-0.5 select-none">
        {/* 1. Company Stamp (Cap Perusahaan) - positioned center/right behind signature */}
        {template.stampImageUrl ? (
          <img
            src={template.stampImageUrl}
            alt="Cap Perusahaan"
            crossOrigin="anonymous"
            className="absolute object-contain pointer-events-none select-none"
            style={{
              left: '52px',
              top: '4px',
              height: '58px',
              maxWidth: '130px',
              mixBlendMode: 'multiply',
              transform: 'rotate(-2deg)',
            }}
          />
        ) : (
          <div
            className="absolute select-none pointer-events-none"
            style={{
              left: '52px',
              top: '5px',
              width: '130px',
              height: '55px',
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
              {/* Outer chevron left */}
              <path
                d="M36 10 L10 38 L36 66 L46 56 L28 38 L46 20 Z"
                fill="#1e40af"
              />
              {/* Inner chevron */}
              <path
                d="M48 20 L32 38 L48 56 L56 48 L44 38 L56 28 Z"
                fill="#1d4ed8"
              />
              {/* JDP Text in stamp blue */}
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
              {/* Company subtext */}
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

        {/* 2. Handwritten Signature (Tanda Tangan) - positioned on left overlapping stamp */}
        {template.signatureImageUrl ? (
          <img
            src={template.signatureImageUrl}
            alt="Tanda Tangan"
            crossOrigin="anonymous"
            className="absolute object-contain pointer-events-none select-none z-10"
            style={{
              left: '0px',
              top: '0px',
              height: '66px',
              maxWidth: '145px',
              mixBlendMode: 'multiply',
            }}
          />
        ) : (
          <div
            className="absolute select-none pointer-events-none z-10"
            style={{
              left: '0px',
              top: '0px',
              width: '145px',
              height: '66px',
              mixBlendMode: 'multiply',
            }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 220 85"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Main cursive loop 'P' and flourish flowing across the stamp */}
              <path
                d="M18 64 C 20 48, 24 22, 30 14 C 36 6, 50 8, 48 24 C 46 38, 26 42, 22 56 C 20 64, 34 62, 46 58 C 58 54, 76 42, 88 44 C 98 46, 92 60, 106 50 C 118 42, 132 40, 145 46 C 158 52, 168 44, 185 40 C 198 38, 210 40, 218 36"
                stroke="#18181b"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Accent slash */}
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
          {template.signerName}
        </p>
        <p className="text-[13px] text-slate-700 leading-tight">
          {template.signerPosition}
        </p>
      </div>
    </div>
  );
};

