/* eslint-disable no-undef */
/**
 * Script untuk minifikasi file JavaScript menggunakan Terser
 * Script ini akan mengkompresi semua file JavaScript di folder dist
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);
const distDir = path.join(__dirname, '..', 'dist');

/**
 * Menemukan semua file JavaScript di direktori secara rekursif
 */
function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (path.extname(file) === '.js') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Mendapatkan ukuran file dalam KB
 */
function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2);
}

/**
 * Mengkompresi file JavaScript menggunakan Terser
 */
async function minifyFile(filePath) {
  // Catat ukuran sebelum minifikasi
  const beforeSize = getFileSizeInKB(filePath);
  
  // Opsi Terser yang seimbang - minifikasi yang baik dengan performa yang lebih baik
  const command = `npx terser "${filePath}" -o "${filePath}" \
  -c passes=2,toplevel=true,drop_console=true,drop_debugger=true,dead_code=true,conditionals=true,booleans=true,collapse_vars=true,comparisons=true,evaluate=true,if_return=true,join_vars=true,loops=true,reduce_vars=true,sequences=true,side_effects=true,unused=true \
  -m toplevel=true,keep_classnames=false,keep_fnames=false \
  --comments false \
  --ecma 2020`;

  try {
    const relativePath = path.relative(distDir, filePath);
    console.log(`Minifikasi: ${relativePath}`);
    await execAsync(command);
    
    // Catat ukuran setelah minifikasi
    const afterSize = getFileSizeInKB(filePath);
    const reduction = ((1 - (afterSize / beforeSize)) * 100).toFixed(2);
    console.log(`  ${relativePath}: ${beforeSize}KB → ${afterSize}KB (${reduction}% pengurangan)`);
  } catch (error) {
    console.error(`Error saat minifikasi ${filePath}:`, error.message);
  }
}

/**
 * Menjalankan minifikasi untuk semua file JavaScript
 */
async function main() {
  console.log('Mulai proses minifikasi kode JavaScript...');
  
  try {
    // Pastikan direktori dist ada
    if (!fs.existsSync(distDir)) {
      console.error('Direktori dist tidak ditemukan. Jalankan "npm run build" terlebih dahulu.');
      process.exit(1);
    }

    // Temukan semua file JS
    const jsFiles = findJsFiles(distDir);
    console.log(`Ditemukan ${jsFiles.length} file JavaScript untuk dikompresi.`);

    let totalSizeBefore = 0;
    let totalSizeAfter = 0;

    // Minifikasi semua file
    for (const file of jsFiles) {
      const beforeSize = parseFloat(getFileSizeInKB(file));
      totalSizeBefore += beforeSize;
      
      await minifyFile(file);
      
      const afterSize = parseFloat(getFileSizeInKB(file));
      totalSizeAfter += afterSize;
    }

    const totalReduction = ((1 - (totalSizeAfter / totalSizeBefore)) * 100).toFixed(2);
    console.log('\nProses minifikasi selesai!');
    console.log(`Total ukuran sebelum: ${totalSizeBefore.toFixed(2)}KB`);
    console.log(`Total ukuran sesudah: ${totalSizeAfter.toFixed(2)}KB`);
    console.log(`Total pengurangan: ${totalReduction}%`);
    console.log('Kode JavaScript telah dioptimalkan dan diobfuskasi dengan performa yang lebih baik.');
  } catch (error) {
    console.error('Error saat menjalankan minifikasi:', error.message);
    process.exit(1);
  }
}

main();
