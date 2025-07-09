import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ReportData } from './report-generator';

export class PDFGenerator {
  static async generatePDF(reportData: ReportData): Promise<Buffer> {
    try {
      const doc = new (jsPDF as any)();
      const { metadata, summary, data, charts } = reportData;
      
      // Set up colors
      const primaryColor = [35, 99, 131]; // TSP brand color #236383
      const lightGray = [248, 249, 250];
      const darkGray = [102, 102, 102];
      
      let yPosition = 20;

      // Header
      doc.setFontSize(20);
      doc.setTextColor(...primaryColor);
      doc.text(metadata.title, 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(12);
      doc.setTextColor(...darkGray);
      doc.text(`${metadata.dateRange} • ${metadata.totalRecords} records`, 20, yPosition);
      
      yPosition += 5;
      doc.text(`Generated on ${new Date(metadata.generatedAt).toLocaleDateString()}`, 20, yPosition);
      
      // Draw header line
      yPosition += 10;
      doc.setDrawColor(...primaryColor);
      doc.setLineWidth(2);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 15;

      // Executive Summary
      doc.setFontSize(16);
      doc.setTextColor(...primaryColor);
      doc.text('Executive Summary', 20, yPosition);
      yPosition += 15;

      // Summary statistics in a grid
      const statsData = [
        ['Total Sandwiches', summary.totalSandwiches.toLocaleString()],
        ['Active Hosts', summary.totalHosts.toString()],
        ['Active Projects', summary.activeProjects.toString()]
      ];

      (doc as any).autoTable({
        startY: yPosition,
        head: [['Metric', 'Value']],
        body: statsData,
        theme: 'grid',
        headStyles: { 
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontSize: 11,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 10
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: 'right' }
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;

      // Top Performers
      if (summary.topPerformers.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(...primaryColor);
        doc.text('Top Performers', 20, yPosition);
        yPosition += 10;

        const performersData = summary.topPerformers.map(performer => [
          performer.name,
          performer.value.toLocaleString()
        ]);

        (doc as any).autoTable({
          startY: yPosition,
          head: [['Name', 'Count']],
          body: performersData,
          theme: 'striped',
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 10
          },
          bodyStyles: {
            fontSize: 9
          },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 30, halign: 'right' }
          }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Charts section
      if (charts && charts.length > 0) {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text('Charts & Visualizations', 20, yPosition);
        yPosition += 15;

        charts.forEach((chart, index) => {
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.text(`📊 ${chart.title}`, 20, yPosition);
          yPosition += 8;
          
          doc.setFontSize(10);
          doc.setTextColor(...darkGray);
          doc.text(`${chart.type.toUpperCase()} Chart: ${chart.data.length} data points`, 25, yPosition);
          yPosition += 15;

          // Simple chart data as table
          if (chart.data.length > 0) {
            const chartData = chart.data.slice(0, 10).map((item: any) => [
              item.label || item.name || 'N/A',
              (item.value || 0).toLocaleString()
            ]);

            (doc as any).autoTable({
              startY: yPosition,
              head: [['Category', 'Value']],
              body: chartData,
              theme: 'plain',
              headStyles: { 
                fillColor: lightGray,
                textColor: [0, 0, 0],
                fontSize: 9
              },
              bodyStyles: {
                fontSize: 8
              },
              columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 30, halign: 'right' }
              }
            });

            yPosition = (doc as any).lastAutoTable.finalY + 10;
          }
        });
      }

      // Data section
      if (Array.isArray(data) && data.length > 0) {
        // Check if we need a new page
        if (yPosition > 200) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setTextColor(...primaryColor);
        doc.text('Detailed Data', 20, yPosition);
        yPosition += 15;

        // Prepare data for table
        const headers = Object.keys(data[0]);
        const tableData = data.slice(0, 50).map(row => // Limit to first 50 rows
          headers.map(header => this.formatValue(row[header]))
        );

        (doc as any).autoTable({
          startY: yPosition,
          head: [headers.map(header => this.formatHeader(header))],
          body: tableData,
          theme: 'striped',
          headStyles: { 
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold'
          },
          bodyStyles: {
            fontSize: 7
          },
          styles: {
            cellPadding: 2,
            overflow: 'linebreak'
          },
          columnStyles: headers.reduce((acc, header, index) => {
            acc[index] = { cellWidth: 'auto' };
            return acc;
          }, {} as any)
        });

        if (data.length > 50) {
          yPosition = (doc as any).lastAutoTable.finalY + 10;
          doc.setFontSize(10);
          doc.setTextColor(...darkGray);
          doc.text(`... and ${data.length - 50} more records`, 20, yPosition);
        }
      }

      // Footer on last page
      const pageCount = doc.getNumberOfPages();
      doc.setPage(pageCount);
      
      yPosition = 280;
      doc.setFontSize(8);
      doc.setTextColor(...darkGray);
      doc.text('Generated by The Sandwich Project Management System', 20, yPosition);

      return Buffer.from(doc.output('arraybuffer'));
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  private static formatHeader(header: string): string {
    return header
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private static formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    if (typeof value === 'string' && value.includes('T')) {
      // Likely a date string
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      } catch (e) {
        // Not a date, return as is
      }
    }
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }
    
    return String(value);
  }
}