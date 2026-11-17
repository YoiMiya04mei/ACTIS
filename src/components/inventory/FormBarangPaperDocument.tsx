import React from "react";
import {
  FORM_BARANG_LOGO_DATA_URI,
  FORM_BARANG_WATERMARK_DATA_URI,
  FORM_BARANG_WAVE_DATA_URI,
} from "@/assets/formBarangAssets";
import {
  DEFAULT_FORM_BARANG_COMPANY,
  DEFAULT_FORM_BARANG_NOTES,
  paginateFormBarangData,
  type FormBarangDocumentData,
  type FormBarangPageSlice,
} from "@/lib/inventoryFormBarang";
import type { WorkTypeOption } from "@/lib/inventoryRequest";

export interface FormBarangPaperDocumentProps {
  doc: FormBarangDocumentData;
  id?: string;
  previewPageFilter?: "all" | number;
}

const BORDER_COLOR = "#93A3B8";
const NAVY_HEADER = "#0F2B59";
const SUBHEADER_BG = "#DBE6F2";
const LABEL_BG = "#F0F4F9";
const TEXT_DARK = "#0F162A";
const TEXT_MUTED = "#334154";
const TEXT_NOTE = "#1D283B";

const cellBaseStyle: React.CSSProperties = {
  border: `1px solid ${BORDER_COLOR}`,
  padding: "2px 6px",
  fontSize: "8pt",
  color: TEXT_DARK,
  verticalAlign: "middle",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

const WordCheckbox: React.FC<{ checked: boolean; label: string }> = ({
  checked,
  label,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontSize: "8.5pt",
      color: TEXT_MUTED,
      lineHeight: 1.25,
      whiteSpace: "nowrap",
    }}
  >
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "9px",
        height: "9px",
        minWidth: "9px",
        border: `1px solid ${checked ? NAVY_HEADER : TEXT_DARK}`,
        backgroundColor: checked ? NAVY_HEADER : "#ffffff",
        boxSizing: "border-box",
      }}
    >
      {checked && (
        <svg
          width="7"
          height="7"
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1.5 5.2L3.9 7.6L8.5 2.4"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
    <span>{label}</span>
  </span>
);

export const FormBarangPaperDocument: React.FC<FormBarangPaperDocumentProps> = ({
  doc,
  id = "form-barang-paper-doc",
  previewPageFilter = "all",
}) => {
  const pages = paginateFormBarangData(doc);
  const visiblePages =
    previewPageFilter === "all"
      ? pages
      : pages.filter((p) => p.pageNumber === previewPageFilter);

  const pagesToRender = visiblePages.length > 0 ? visiblePages : pages;

  const isWorkTypeChecked = (wt: WorkTypeOption) =>
    doc.requestInfo.workTypes.includes(wt);

  const renderPage = (slice: FormBarangPageSlice, idx: number, totalVisible: number) => {
    const isLastRendered = idx === totalVisible - 1;

    return (
      <div
        key={slice.pageNumber}
        id={`${id}-page-${slice.pageNumber}`}
        data-page-index={slice.pageNumber}
        className={`form-barang-page relative bg-white mx-auto overflow-hidden shadow-2xl print:shadow-none ${
          isLastRendered ? "mb-0" : "mb-8 print:mb-0 print:break-after-page"
        }`}
        style={{
          width: "794px",
          minWidth: "794px",
          maxWidth: "794px",
          height: "1123px",
          minHeight: "1123px",
          maxHeight: "1123px",
          backgroundColor: "#ffffff",
          color: TEXT_DARK,
          fontFamily: "Arial, Helvetica, sans-serif",
          boxSizing: "border-box",
          position: "relative",
          pageBreakAfter: isLastRendered ? "auto" : "always",
          breakAfter: isLastRendered ? "auto" : "page",
        }}
      >
        {/* Top-Right Decorative Wave Ornament (identical Kop Surat across every page) */}
        <img
          src={FORM_BARANG_WAVE_DATA_URI}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "240px",
            height: "102px",
            objectFit: "fill",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 1,
          }}
        />

        {/* Diagonal Center Watermark (behind content & transparent table cells) */}
        <img
          src={FORM_BARANG_WATERMARK_DATA_URI}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "135px",
            top: "246px",
            width: "536px",
            height: "653px",
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 0,
          }}
        />

        {/* JDP Left Header Logo */}
        <img
          src={FORM_BARANG_LOGO_DATA_URI}
          alt="Logo PT Jembatan Data Pangrango"
          style={{
            position: "absolute",
            top: "14px",
            left: "34px",
            width: "170px",
            height: "67px",
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 2,
          }}
        />

        {/* Center Company Kop Surat Block */}
        <div
          style={{
            position: "absolute",
            top: "21px",
            left: "210px",
            width: "375px",
            textAlign: "center",
            zIndex: 3,
            color: "#000000",
          }}
        >
          <div
            style={{
              fontSize: "14pt",
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#000000",
              letterSpacing: "0.01em",
            }}
          >
            {DEFAULT_FORM_BARANG_COMPANY.name}
          </div>
          <div
            style={{
              fontSize: "8.5pt",
              lineHeight: 1.28,
              color: "#000000",
              marginTop: "3px",
            }}
          >
            {DEFAULT_FORM_BARANG_COMPANY.addressLine}
          </div>
          <div
            style={{
              fontSize: "8.5pt",
              lineHeight: 1.25,
              color: "#000000",
              marginTop: "1px",
            }}
          >
            Email :{" "}
            <span style={{ color: "#0000FF" }}>
              {DEFAULT_FORM_BARANG_COMPANY.email}
            </span>{" "}
            Web : {DEFAULT_FORM_BARANG_COMPANY.website}
          </div>
        </div>

        {/* Double Horizontal Black Rule (exact 26.21mm from top, 178mm wide) */}
        <div
          style={{
            position: "absolute",
            top: "99px",
            left: "60.5px",
            width: "673px",
            zIndex: 2,
          }}
        >
          <div style={{ width: "100%", height: "1px", backgroundColor: "#000000" }} />
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#000000",
              marginTop: "1px",
            }}
          />
        </div>

        {/* Form Title (only on Page 1: FORM BARANG; continuation pages start directly under Kop Surat) */}
        {slice.title && (
          <div
            style={{
              position: "absolute",
              top: "121px",
              left: "60.5px",
              width: "673px",
              textAlign: "center",
              fontSize: "11.5pt",
              fontWeight: 700,
              color: NAVY_HEADER,
              letterSpacing: "0.01em",
              zIndex: 3,
            }}
          >
            {slice.title}
          </div>
        )}

        {/* Main Content Body (strictly bounded between Title/Kop Surat and Footer top) */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            paddingTop: slice.title ? "152px" : "118px",
            paddingLeft: "60.5px",
            paddingRight: "60.5px",
            paddingBottom: "78px",
            boxSizing: "border-box",
          }}
        >
          {/* ================= INFORMASI REQUEST TABLE ================= */}
          {slice.includeRequestInfo && (
            <div style={{ marginBottom: "10px" }}>
              <table
                style={{
                  width: "673px",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                }}
              >
                <colgroup>
                  <col style={{ width: "114px" }} />
                  <col style={{ width: "222px" }} />
                  <col style={{ width: "141px" }} />
                  <col style={{ width: "196px" }} />
                </colgroup>
                <tbody>
                  <tr style={{ height: "24.5px" }}>
                    <td
                      colSpan={4}
                      style={{
                        backgroundColor: NAVY_HEADER,
                        color: "#FFFFFF",
                        fontSize: "9pt",
                        fontWeight: 700,
                        padding: "3px 8px",
                        border: `1px solid ${NAVY_HEADER}`,
                      }}
                    >
                      INFORMASI REQUEST
                    </td>
                  </tr>
                  <tr style={{ height: "23px" }}>
                    <td
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: LABEL_BG,
                        fontSize: "8.5pt",
                        fontWeight: 700,
                        padding: "4px 6px",
                      }}
                    >
                      Nama Tim
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        fontSize: "8.5pt",
                        color: doc.requestInfo.namaTim ? TEXT_DARK : TEXT_MUTED,
                        fontWeight: doc.requestInfo.namaTim ? 600 : 400,
                        padding: "4px 6px",
                      }}
                    >
                      {doc.requestInfo.namaTim ||
                        "................................................"}
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: LABEL_BG,
                        fontSize: "8.5pt",
                        fontWeight: 700,
                        padding: "4px 6px",
                      }}
                    >
                      Tanggal Request
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        fontSize: "8.5pt",
                        color: doc.requestInfo.tanggalRequest ? TEXT_DARK : TEXT_MUTED,
                        fontWeight: doc.requestInfo.tanggalRequest ? 600 : 400,
                        padding: "4px 6px",
                      }}
                    >
                      {doc.requestInfo.tanggalRequest ||
                        "........................................"}
                    </td>
                  </tr>
                  <tr style={{ height: "38px" }}>
                    <td
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: LABEL_BG,
                        fontSize: "8.5pt",
                        fontWeight: 700,
                        padding: "4px 6px",
                      }}
                    >
                      Jenis Pekerjaan
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        fontSize: "8.5pt",
                        padding: "4px 6px",
                        lineHeight: 1.35,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          rowGap: "3px",
                          columnGap: "6px",
                        }}
                      >
                        <WordCheckbox
                          checked={isWorkTypeChecked("Pemasangan")}
                          label="Pemasangan"
                        />
                        <WordCheckbox
                          checked={isWorkTypeChecked("Perbaikan")}
                          label="Perbaikan"
                        />
                        <WordCheckbox
                          checked={isWorkTypeChecked("Backbone")}
                          label="Backbone"
                        />
                        <WordCheckbox
                          checked={isWorkTypeChecked("Lainnya")}
                          label={
                            isWorkTypeChecked("Lainnya") && doc.requestInfo.workTypeOther
                              ? `Lainnya (${doc.requestInfo.workTypeOther})`
                              : "Lainnya"
                          }
                        />
                      </div>
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: LABEL_BG,
                        fontSize: "8.5pt",
                        fontWeight: 700,
                        padding: "4px 6px",
                      }}
                    >
                      Lokasi Pengembalian
                    </td>
                    <td
                      style={{
                        ...cellBaseStyle,
                        fontSize: "8.5pt",
                        color: doc.requestInfo.lokasiPengembalian ? TEXT_DARK : TEXT_MUTED,
                        fontWeight: doc.requestInfo.lokasiPengembalian ? 600 : 400,
                        padding: "4px 6px",
                      }}
                    >
                      {doc.requestInfo.lokasiPengembalian ||
                        "........................................"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ================= A. BARANG KELUAR ================= */}
          {slice.keluarHeaderVisible && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  width: "673px",
                  height: "24.5px",
                  backgroundColor: NAVY_HEADER,
                  color: "#FFFFFF",
                  fontSize: "9pt",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                  boxSizing: "border-box",
                }}
              >
                {slice.keluarContinuation
                  ? "A. BARANG KELUAR (Lanjutan)"
                  : "A. BARANG KELUAR"}
              </div>
              <div
                style={{
                  fontSize: "8pt",
                  fontStyle: "italic",
                  color: TEXT_MUTED,
                  marginTop: "3px",
                  marginBottom: "4px",
                }}
              >
                Daftar barang yang dikeluarkan dari inventory untuk kebutuhan pekerjaan tim lapangan.
              </div>
              <table
                style={{
                  width: "673px",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                }}
              >
                <colgroup>
                  <col style={{ width: "34px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "185px" }} />
                  <col style={{ width: "234px" }} />
                  <col style={{ width: "100px" }} />
                </colgroup>
                <thead>
                  <tr style={{ height: "24px", backgroundColor: SUBHEADER_BG }}>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "2px 3px",
                      }}
                    >
                      No.
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      No. Transaksi
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Nama Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      SN Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Jumlah Barang
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.keluarRows.map((row, rowIdx) => (
                    <tr key={row ? `k-${row.no}` : `k-empty-${rowIdx}`} style={{ height: "20px" }}>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.no : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: "center",
                          fontSize: "7.2pt",
                          padding: "3px 4px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row ? row.transactionNumber : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.itemName : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: row && row.snBarang !== "-" ? "left" : "center",
                          fontSize: "7.5pt",
                          lineHeight: 1.35,
                        }}
                      >
                        {row ? row.snBarang : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.quantity : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= B. BARANG TERPAKAI ================= */}
          {slice.terpakaiHeaderVisible && (
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  width: "673px",
                  height: "24.5px",
                  backgroundColor: NAVY_HEADER,
                  color: "#FFFFFF",
                  fontSize: "9pt",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                  boxSizing: "border-box",
                }}
              >
                {slice.terpakaiContinuation
                  ? "B. BARANG TERPAKAI (Lanjutan)"
                  : "B. BARANG TERPAKAI"}
              </div>
              <div
                style={{
                  fontSize: "8pt",
                  fontStyle: "italic",
                  color: TEXT_MUTED,
                  marginTop: "3px",
                  marginBottom: "4px",
                }}
              >
                Daftar barang yang benar-benar digunakan selama pelaksanaan pekerjaan di lapangan.
              </div>
              <table
                style={{
                  width: "673px",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                }}
              >
                <colgroup>
                  <col style={{ width: "30px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "132px" }} />
                  <col style={{ width: "148px" }} />
                  <col style={{ width: "68px" }} />
                  <col style={{ width: "99px" }} />
                  <col style={{ width: "88px" }} />
                </colgroup>
                <thead>
                  <tr style={{ height: "36px", backgroundColor: SUBHEADER_BG }}>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "2px 3px",
                      }}
                    >
                      No.
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      No. Transaksi
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Nama Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      SN Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      Jumlah Terpakai
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Nama Client
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Lokasi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.terpakaiRows.map((row, rowIdx) => (
                    <tr key={row ? `t-${row.no}` : `t-empty-${rowIdx}`} style={{ height: "20px" }}>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.no : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: "center",
                          fontSize: "7.2pt",
                          padding: "3px 4px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row ? row.transactionNumber : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.itemName : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: row && row.snBarang !== "-" ? "left" : "center",
                          fontSize: "7.5pt",
                          lineHeight: 1.35,
                        }}
                      >
                        {row ? row.snBarang : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.quantityUsed : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.clientName : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.location : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= C. BARANG KEMBALI / SISA ================= */}
          {slice.kembaliHeaderVisible && (
            <div style={{ marginBottom: "14px" }}>
              <div
                style={{
                  width: "673px",
                  height: "24.5px",
                  backgroundColor: NAVY_HEADER,
                  color: "#FFFFFF",
                  fontSize: "9pt",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: "8px",
                  boxSizing: "border-box",
                }}
              >
                {slice.kembaliContinuation
                  ? "C. BARANG KEMBALI / SISA (Lanjutan)"
                  : "C. BARANG KEMBALI / SISA"}
              </div>
              <div
                style={{
                  fontSize: "8pt",
                  fontStyle: "italic",
                  color: TEXT_MUTED,
                  marginTop: "3px",
                  marginBottom: "4px",
                }}
              >
                Daftar barang yang tidak terpakai dan dikembalikan ke inventory.
              </div>
              <table
                style={{
                  width: "673px",
                  tableLayout: "fixed",
                  borderCollapse: "collapse",
                }}
              >
                <colgroup>
                  <col style={{ width: "30px" }} />
                  <col style={{ width: "108px" }} />
                  <col style={{ width: "128px" }} />
                  <col style={{ width: "144px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "86px" }} />
                  <col style={{ width: "105px" }} />
                </colgroup>
                <thead>
                  <tr style={{ height: "36px", backgroundColor: SUBHEADER_BG }}>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                        padding: "2px 3px",
                      }}
                    >
                      No.
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      No. Transaksi
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Nama Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      SN Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      Jumlah Kembali
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Kondisi Barang
                    </th>
                    <th
                      style={{
                        ...cellBaseStyle,
                        backgroundColor: SUBHEADER_BG,
                        fontWeight: 700,
                        textAlign: "center",
                      }}
                    >
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.kembaliRows.map((row, rowIdx) => (
                    <tr key={row ? `c-${row.no}` : `c-empty-${rowIdx}`} style={{ height: "20px" }}>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.no : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: "center",
                          fontSize: "7.2pt",
                          padding: "3px 4px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row ? row.transactionNumber : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.itemName : ""}
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          textAlign: row && row.snBarang !== "-" ? "left" : "center",
                          fontSize: "7.5pt",
                          lineHeight: 1.35,
                        }}
                      >
                        {row ? row.snBarang : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.quantityReturned : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "center" }}>
                        {row ? row.condition : ""}
                      </td>
                      <td style={{ ...cellBaseStyle, textAlign: "left" }}>
                        {row ? row.notes : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ================= B. PERSETUJUAN DAN SERAH TERIMA ================= */}
          {slice.includeApprovalAndNotes && (
            <>
              <div style={{ marginBottom: "10px" }}>
                <table
                  style={{
                    width: "673px",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "224px" }} />
                    <col style={{ width: "225px" }} />
                    <col style={{ width: "224px" }} />
                  </colgroup>
                  <tbody>
                    <tr style={{ height: "24.5px" }}>
                      <td
                        colSpan={3}
                        style={{
                          backgroundColor: NAVY_HEADER,
                          color: "#FFFFFF",
                          fontSize: "9pt",
                          fontWeight: 700,
                          padding: "3px 8px",
                          border: `1px solid ${NAVY_HEADER}`,
                        }}
                      >
                        B. PERSETUJUAN DAN SERAH TERIMA
                      </td>
                    </tr>
                    <tr style={{ height: "24.5px", backgroundColor: SUBHEADER_BG }}>
                      <td
                        style={{
                          ...cellBaseStyle,
                          backgroundColor: SUBHEADER_BG,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        Pemohon
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          backgroundColor: SUBHEADER_BG,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        Pengelola Gudang
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          backgroundColor: SUBHEADER_BG,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        Penerima
                      </td>
                    </tr>
                    <tr style={{ height: "24.5px" }}>
                      <td
                        style={{
                          ...cellBaseStyle,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        SPV Teknisi
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        SPV Customer Service
                      </td>
                      <td
                        style={{
                          ...cellBaseStyle,
                          fontSize: "8.5pt",
                          fontWeight: 700,
                          textAlign: "center",
                        }}
                      >
                        PIC Tim Lapangan
                      </td>
                    </tr>
                    <tr style={{ height: "67px" }}>
                      {[
                        doc.approval.pemohonName,
                        doc.approval.pengelolaName,
                        doc.approval.penerimaName,
                      ].map((signerName, sIdx) => (
                        <td
                          key={sIdx}
                          style={{
                            ...cellBaseStyle,
                            verticalAlign: "bottom",
                            textAlign: "center",
                            paddingBottom: "6px",
                            fontSize: "8.5pt",
                            fontWeight: signerName.trim() ? 600 : 400,
                          }}
                        >
                          {signerName.trim()
                            ? `( ${signerName.trim()} )`
                            : "( ............................. )"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ================= CATATAN ================= */}
              <div style={{ marginTop: "6px", paddingLeft: "2px" }}>
                <div
                  style={{
                    fontSize: "8.5pt",
                    fontWeight: 700,
                    color: TEXT_DARK,
                    marginBottom: "4px",
                  }}
                >
                  CATATAN:
                </div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: "18px",
                    fontSize: "8pt",
                    color: TEXT_NOTE,
                    lineHeight: 1.45,
                  }}
                >
                  {DEFAULT_FORM_BARANG_NOTES.map((note, nIdx) => (
                    <li key={nIdx} style={{ marginBottom: "1px" }}>
                      {note}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>

        {/* ================= FIXED PAGE FOOTER (exact Word footer1.xml) ================= */}
        <div
          style={{
            position: "absolute",
            left: "60.5px",
            bottom: "24px",
            width: "673px",
            zIndex: 3,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#CAD4E1",
              marginBottom: "5px",
            }}
          />
          <div
            style={{
              fontSize: "8.5pt",
              fontWeight: 700,
              color: "#000000",
              lineHeight: 1.25,
            }}
          >
            {DEFAULT_FORM_BARANG_COMPANY.name}
          </div>
          <div
            style={{
              fontSize: "7.5pt",
              color: TEXT_NOTE,
              lineHeight: 1.3,
              maxWidth: "465px",
            }}
          >
            {DEFAULT_FORM_BARANG_COMPANY.addressLine} Email :{" "}
            <span style={{ color: "#0000FF" }}>
              {DEFAULT_FORM_BARANG_COMPANY.email}
            </span>{" "}
            Web : {DEFAULT_FORM_BARANG_COMPANY.website}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id={id} className="form-barang-container w-full flex flex-col items-center">
      {pagesToRender.map((slice, idx) => renderPage(slice, idx, pagesToRender.length))}
    </div>
  );
};
