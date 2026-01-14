'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { UploadCloud, Download, FileSpreadsheet, X, CheckCircle, User } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

export default function GreatDayToBpsPdfPage() {
  const [attendanceData, setAttendanceData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [employeeStats, setEmployeeStats] = useState(null);
  const [pdfConfig, setPdfConfig] = useState({
    employeeName: '',
    checkedBy: '',
    approvedBy: ''
  });

  const handleFileUpload = (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError('Please upload a valid Excel file (.xlsx or .xls) from Great Day');
      return;
    }

    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData && jsonData.length > 3) {
          setAttendanceData(jsonData);
          calculateStats(jsonData);
          extractEmployeeData(jsonData);
        } else {
          setError('Excel file appears to be empty or invalid');
        }
      } catch (err) {
        setError('Error reading Excel file: ' + err.message);
      }
    };
    
    reader.onerror = () => setError('Error reading file');
    reader.readAsArrayBuffer(file);
  };

  const extractEmployeeData = (data) => {
    if (data.length > 3) {
      const firstDataRow = data[3];
      setPdfConfig(prev => ({
        ...prev,
        employeeName: firstDataRow[2] || ''
      }));
    }
  };

  const calculateStats = (data) => {
    if (!data || data.length < 4) return;
    
    const dataRows = data.slice(3);
    const employees = new Set();
    const dates = new Set();
    
    dataRows.forEach(row => {
      if (row[1]) employees.add(row[1]);
      if (row[5]) dates.add(row[5]);
    });
    
    setEmployeeStats({
      totalRecords: dataRows.length,
      uniqueEmployees: employees.size,
      dateRange: dates.size
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
  };

  const generatePDF = () => {
    if (!attendanceData || attendanceData.length === 0) {
      setError('No data to export');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Attendance Report', pageWidth / 2, 15, { align: 'center' });
    
    // Prepare table data
    const headers = ['No.', 'Emp No.', 'Employee', 'Date', 'Shift Name', 'Shift In', 'Shift Out', 'Actual In', 'Actual Out', 'Remark'];
    const dataRows = attendanceData.slice(3).map(row => [
      row[0] || '',
      row[1] || '',
      row[2] || '',
      row[5] || '',
      row[6] || '',
      row[7] || '',
      row[8] || '',
      row[9] || '',
      row[10] || '',
      ''
    ]);

    // Find remarks for justification
    const justifications = [];
    attendanceData.slice(3).forEach(row => {
      const remark = row[10] || '';
      const date = row[5] || '';
      if (remark && remark !== '' && date) {
        justifications.push(`${date}: ${remark}`);
      }
    });

    // Main table
    doc.autoTable({
      head: [headers],
      body: dataRows,
      startY: 22,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [0, 0, 0]
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 45 },
        5: { cellWidth: 15 },
        6: { cellWidth: 15 },
        7: { cellWidth: 15 },
        8: { cellWidth: 15 },
        9: { cellWidth: 60 }
      },
      didDrawPage: (data) => {
        if (data.pageNumber === data.pageCount) {
          let finalY = data.cursor.y + 5;
          
          // Justification section
          if (justifications.length > 0) {
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.text('Justifikasi :', 10, finalY);
            doc.setFont(undefined, 'normal');
            
            justifications.forEach((just, i) => {
              doc.text(just, 10, finalY + 5 + (i * 4));
            });
            
            finalY += 5 + (justifications.length * 4) + 3;
          }
          
          // Declaration
          doc.setFontSize(7);
          doc.setFont(undefined, 'normal');
          const declaration = 'Dengan ini saya menyatakan dengan sebenarnya bahwa seluruh data dan informasi yang saya sampaikan dalam dokumen ini adalah benar dan dapat dipertanggung jawabkan. Apabila ditemukan data yang tidak valid atau palsu, saya bersedia menerima sanksi sesuai dengan peraturan yang berlaku.';
          const splitDeclaration = doc.splitTextToSize(declaration, pageWidth - 20);
          doc.text(splitDeclaration, 10, finalY);
          finalY += (splitDeclaration.length * 3) + 3;
          
          // Print date
          const now = new Date();
          const printDate = `Tanggal Cetak : ${now.toLocaleDateString('en-US', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB')}`;
          doc.text(printDate, 10, finalY);
          finalY += 8;
          
          // Signature section
          const colWidth = (pageWidth - 20) / 3;
          
          doc.setFont(undefined, 'bold');
          doc.text('Tanda Tangan Pegawai,', 10, finalY);
          doc.text(`( ${pdfConfig.employeeName || 'EMPLOYEE NAME'} )`, 10, finalY + 20);
          
          doc.text('Diperiksa Oleh :', 10 + colWidth, finalY);
          doc.text(`( ${pdfConfig.checkedBy || 'CHECKER NAME'} )`, 10 + colWidth, finalY + 20);
          
          doc.text('Disetujui Oleh :', 10 + (colWidth * 2), finalY);
          doc.text(`( ${pdfConfig.approvedBy || 'APPROVER NAME'} )`, 10 + (colWidth * 2), finalY + 20);
        }
      }
    });

    const outputFileName = fileName.replace(/\.(xlsx|xls)$/i, '_BPS_Format.pdf');
    doc.save(outputFileName);
  };

  const clearFile = () => {
    setAttendanceData(null);
    setFileName('');
    setError('');
    setEmployeeStats(null);
    setPdfConfig({ employeeName: '', checkedBy: '', approvedBy: '' });
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Great Day to BPS PDF Converter
            </h1>
            <p className="text-gray-600">
              Convert Great Day attendance exports to BPS format PDF with signature section
            </p>
          </header>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-green-600" />
                Upload Great Day Export
              </h2>

              {!attendanceData ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                    isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  <FileSpreadsheet className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
                  <p className="text-gray-600 mb-2">Drag and drop Great Day Excel export here</p>
                  <p className="text-gray-500 text-sm mb-4">or</p>
                  <label className="inline-block">
                    <input type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
                    <span className="bg-green-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-green-700 transition-colors inline-block">
                      Browse Files
                    </span>
                  </label>
                  <p className="text-xs text-gray-500 mt-4">Accepts: .xlsx, .xls files</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-800">{fileName}</p>
                        {employeeStats && (
                          <p className="text-sm text-gray-600">
                            {employeeStats.totalRecords} records • {employeeStats.uniqueEmployees} employees
                          </p>
                        )}
                      </div>
                    </div>
                    <button onClick={clearFile} className="p-2 hover:bg-green-100 rounded-lg transition-colors">
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-800">PDF Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
                      <input
                        type="text"
                        value={pdfConfig.employeeName}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, employeeName: e.target.value })}
                        placeholder="Auto-detected from file"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Checked By (Diperiksa Oleh)</label>
                      <input
                        type="text"
                        value={pdfConfig.checkedBy}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, checkedBy: e.target.value })}
                        placeholder="e.g., ATHIANA NURUL"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Approved By (Disetujui Oleh)</label>
                      <input
                        type="text"
                        value={pdfConfig.approvedBy}
                        onChange={(e) => setPdfConfig({ ...pdfConfig, approvedBy: e.target.value })}
                        placeholder="e.g., ASWIN SWASTIKA"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-gray-900"
                      />
                    </div>

                    <button
                      onClick={generatePDF}
                      className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                      <Download className="w-5 h-5" />
                      Download BPS Format PDF
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Preview Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-green-600" />
                Data Preview
              </h2>

              {attendanceData && attendanceData.length > 0 ? (
                <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-green-50 sticky top-0">
                      <tr>
                        {attendanceData[2]?.map((header, index) => (
                          <th key={index} className="px-2 py-2 text-left text-xs font-medium text-gray-700">
                            {header || `Col ${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {attendanceData.slice(3, 23).map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-2 py-2 whitespace-nowrap">
                              {cell || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {attendanceData.length > 23 && (
                    <div className="p-3 bg-gray-50 text-center text-xs text-gray-600">
                      Showing first 20 data rows of {attendanceData.length - 3} total
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No attendance data to preview</p>
                  <p className="text-sm mt-2">Upload a Great Day export to see the data</p>
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">PDF Output Features</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>Complete attendance table with BPS format headers</li>
              <li>Automatic justification section for remarks (WFH, Cuti, etc.)</li>
              <li>Signature section with employee, checker, and approver fields</li>
              <li>Declaration statement and print date</li>
              <li>Professional landscape layout optimized for printing</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}