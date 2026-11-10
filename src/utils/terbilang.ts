/**
 * Mengonversi angka nominal ke kalimat terbilang Bahasa Indonesia.
 * Contoh:
 * 883250 -> "Delapan Ratus Delapan Puluh Tiga Ribu Dua Ratus Lima Puluh Rupiah"
 * 1273891 -> "Satu Juta Dua Ratus Tujuh Puluh Tiga Ribu Delapan Ratus Sembilan Puluh Satu Rupiah"
 */

const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function angkaKeKata(num: number): string {
  const angka = Math.floor(Math.abs(num));
  if (angka === 0) return 'Nol';

  if (angka < 12) {
    return SATUAN[angka];
  } else if (angka < 20) {
    return angkaKeKata(angka - 10) + ' Belas';
  } else if (angka < 100) {
    const sisa = angka % 10;
    return (
      angkaKeKata(Math.floor(angka / 10)) +
      ' Puluh' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  } else if (angka < 200) {
    const sisa = angka - 100;
    return 'Seratus' + (sisa ? ' ' + angkaKeKata(sisa) : '');
  } else if (angka < 1000) {
    const sisa = angka % 100;
    return (
      angkaKeKata(Math.floor(angka / 100)) +
      ' Ratus' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  } else if (angka < 2000) {
    const sisa = angka - 1000;
    return 'Seribu' + (sisa ? ' ' + angkaKeKata(sisa) : '');
  } else if (angka < 1000000) {
    const sisa = angka % 1000;
    return (
      angkaKeKata(Math.floor(angka / 1000)) +
      ' Ribu' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  } else if (angka < 1000000000) {
    const sisa = angka % 1000000;
    return (
      angkaKeKata(Math.floor(angka / 1000000)) +
      ' Juta' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  } else if (angka < 1000000000000) {
    const sisa = angka % 1000000000;
    return (
      angkaKeKata(Math.floor(angka / 1000000000)) +
      ' Miliar' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  } else {
    const sisa = angka % 1000000000000;
    return (
      angkaKeKata(Math.floor(angka / 1000000000000)) +
      ' Triliun' +
      (sisa ? ' ' + angkaKeKata(sisa) : '')
    );
  }
}

export function terbilangRupiah(num: number): string {
  if (isNaN(num) || num <= 0) return 'Nol Rupiah';
  const kata = angkaKeKata(num);
  return `${kata.trim()} Rupiah`;
}

