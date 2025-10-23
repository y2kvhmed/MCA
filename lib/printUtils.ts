import { Platform } from 'react-native';

interface PrintOptions {
  title?: string;
  orientation?: 'portrait' | 'landscape';
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  includeHeader?: boolean;
  includeFooter?: boolean;
  customCSS?: string;
}

export class PrintManager {
  static async printHTML(html: string, options: PrintOptions = {}) {
    if (Platform.OS === 'web') {
      return this.printWebHTML(html, options);
    } else {
      // For mobile, you'd use expo-print
      console.log('Mobile printing not implemented yet');
      return false;
    }
  }

  private static printWebHTML(html: string, options: PrintOptions) {
    const {
      title = 'Physics Learning Platform',
      orientation = 'portrait',
      margins = { top: 20, bottom: 20, left: 20, right: 20 },
      includeHeader = true,
      includeFooter = true,
      customCSS = '',
    } = options;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;

    const printCSS = `
      <style>
        @media print {
          @page {
            size: A4 ${orientation};
            margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            font-size: 12pt;
          }
          
          .print-header {
            border-bottom: 2px solid #001F3F;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          
          .print-header h1 {
            color: #001F3F;
            margin: 0;
            font-size: 18pt;
          }
          
          .print-header .subtitle {
            color: #666;
            font-size: 10pt;
            margin-top: 5px;
          }
          
          .print-footer {
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 20px;
            font-size: 9pt;
            color: #666;
            text-align: center;
          }
          
          .page-break {
            page-break-before: always;
          }
          
          .no-print {
            display: none !important;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
          }
          
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          
          .assignment-card, .student-card, .material-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            break-inside: avoid;
          }
          
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 9pt;
            font-weight: bold;
          }
          
          .status-submitted { background-color: #e3f2fd; color: #1976d2; }
          .status-graded { background-color: #e8f5e8; color: #2e7d32; }
          .status-missing { background-color: #ffebee; color: #c62828; }
          
          .grade-display {
            font-size: 14pt;
            font-weight: bold;
            color: #2e7d32;
          }
          
          .chart-container {
            break-inside: avoid;
            margin: 20px 0;
          }
          
          ${customCSS}
        }
        
        @media screen {
          .print-only {
            display: none;
          }
        }
      </style>
    `;

    const headerHTML = includeHeader ? `
      <div class="print-header">
        <h1>${title}</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
      </div>
    ` : '';

    const footerHTML = includeFooter ? `
      <div class="print-footer">
        <div>Physics Learning Platform - ${new Date().getFullYear()}</div>
        <div>Page <span class="page-number"></span></div>
      </div>
    ` : '';

    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          ${printCSS}
        </head>
        <body>
          ${headerHTML}
          ${html}
          ${footerHTML}
        </body>
      </html>
    `;

    printWindow.document.write(fullHTML);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    };

    return true;
  }

  // Generate printable student report
  static generateStudentReport(student: any, assignments: any[]) {
    const submittedCount = assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length;
    const gradedCount = assignments.filter(a => a.status === 'graded').length;
    const averageGrade = gradedCount > 0 
      ? assignments.filter(a => a.grade).reduce((sum, a) => sum + a.grade, 0) / gradedCount 
      : 0;

    return `
      <div class="student-report">
        <div class="student-header">
          <h2>${student.name}</h2>
          <p><strong>Email:</strong> ${student.email || 'Not provided'}</p>
          <p><strong>School:</strong> ${student.school?.name || 'Not assigned'}</p>
        </div>
        
        <div class="performance-summary">
          <h3>Performance Summary</h3>
          <table>
            <tr>
              <td><strong>Total Assignments:</strong></td>
              <td>${assignments.length}</td>
            </tr>
            <tr>
              <td><strong>Submitted:</strong></td>
              <td>${submittedCount}</td>
            </tr>
            <tr>
              <td><strong>Graded:</strong></td>
              <td>${gradedCount}</td>
            </tr>
            <tr>
              <td><strong>Average Grade:</strong></td>
              <td class="grade-display">${averageGrade.toFixed(1)}%</td>
            </tr>
          </table>
        </div>
        
        <div class="assignments-detail">
          <h3>Assignment Details</h3>
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Type</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${assignments.map(assignment => `
                <tr>
                  <td>${assignment.title}</td>
                  <td>${assignment.assignment_type}</td>
                  <td>${assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</td>
                  <td><span class="status-badge status-${assignment.status}">${assignment.status}</span></td>
                  <td>${assignment.grade ? `${assignment.grade}/${assignment.max_score}` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Generate printable assignment overview
  static generateAssignmentOverview(assignments: any[], students: any[]) {
    return `
      <div class="assignment-overview">
        <h2>Assignment Overview</h2>
        <p><strong>Total Assignments:</strong> ${assignments.length}</p>
        <p><strong>Total Students:</strong> ${students.length}</p>
        
        ${assignments.map(assignment => `
          <div class="assignment-card page-break">
            <h3>${assignment.title}</h3>
            <p><strong>Type:</strong> ${assignment.assignment_type}</p>
            <p><strong>Due Date:</strong> ${assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</p>
            <p><strong>Max Score:</strong> ${assignment.max_score || 'N/A'}</p>
            
            <h4>Student Submissions</h4>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Submitted Date</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                ${students.map(student => {
                  const submission = assignment.submissions?.find((s: any) => s.student_id === student.id);
                  return `
                    <tr>
                      <td>${student.name}</td>
                      <td><span class="status-badge status-${submission?.status || 'missing'}">${submission?.status || 'missing'}</span></td>
                      <td>${submission?.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : '-'}</td>
                      <td>${submission?.grade ? `${submission.grade}/${assignment.max_score}` : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Generate printable materials list
  static generateMaterialsList(materials: any[]) {
    return `
      <div class="materials-list">
        <h2>Materials List</h2>
        <p><strong>Total Materials:</strong> ${materials.length}</p>
        
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Description</th>
              <th>Created Date</th>
              <th>File Attached</th>
              <th>School</th>
            </tr>
          </thead>
          <tbody>
            ${materials.map(material => `
              <tr>
                <td><strong>${material.title}</strong></td>
                <td>${material.description || 'No description'}</td>
                <td>${new Date(material.created_at).toLocaleDateString()}</td>
                <td>${material.file_path ? 'Yes' : 'No'}</td>
                <td>${material.school?.name || 'All Schools'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}