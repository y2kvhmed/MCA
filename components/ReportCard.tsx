import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../lib/utils';
import { Spacing } from '../constants/Styles';

interface ReportCardProps {
  student: {
    id: string;
    name: string;
    email: string;
    grade_level?: string;
    student_id?: string;
  };
  school: {
    name: string;
    address?: string;
  };
  grades: Array<{
    subject: string;
    assignment: string;
    grade: number;
    max_score: number;
    percentage: number;
    date: string;
  }>;
  period: {
    start_date: string;
    end_date: string;
    term: string;
  };
  stats: {
    overall_average: number;
    total_assignments: number;
    completed_assignments: number;
    attendance_percentage: number;
  };
  onDownload?: () => void;
  onShare?: () => void;
}

export default function ReportCard({
  student,
  school,
  grades,
  period,
  stats,
  onDownload,
  onShare
}: ReportCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return colors.success;
    if (percentage >= 80) return colors.info;
    if (percentage >= 70) return colors.warning;
    return colors.error;
  };

  const getGradeLetter = (percentage: number) => {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  };

  const generateReportHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Report Card - ${student.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: white;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #001F3F;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .school-name {
            font-size: 24px;
            font-weight: bold;
            color: #001F3F;
            margin-bottom: 5px;
          }
          .report-title {
            font-size: 20px;
            color: #666;
            margin-bottom: 10px;
          }
          .period {
            font-size: 14px;
            color: #999;
          }
          .student-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: 600;
            color: #001F3F;
          }
          .grades-section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #001F3F;
            margin-bottom: 15px;
            border-bottom: 2px solid #ffe164;
            padding-bottom: 5px;
          }
          .grades-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .grades-table th,
          .grades-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
          }
          .grades-table th {
            background: #001F3F;
            color: white;
            font-weight: 600;
          }
          .grade-excellent { color: #34C759; font-weight: bold; }
          .grade-good { color: #007AFF; font-weight: bold; }
          .grade-fair { color: #FF9500; font-weight: bold; }
          .grade-poor { color: #FF3B30; font-weight: bold; }
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 30px;
          }
          .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #001F3F;
          }
          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #001F3F;
            margin-bottom: 5px;
          }
          .stat-label {
            font-size: 14px;
            color: #666;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .signature {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">${school.name}</div>
          <div class="report-title">Student Progress Report</div>
          <div class="period">${period.term} • ${formatDate(period.start_date)} - ${formatDate(period.end_date)}</div>
        </div>

        <div class="student-info">
          <div class="info-row">
            <span class="info-label">Student Name:</span>
            <span>${student.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Student ID:</span>
            <span>${student.student_id || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Grade Level:</span>
            <span>${student.grade_level || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span>${student.email}</span>
          </div>
        </div>

        <div class="summary-stats">
          <div class="stat-card">
            <div class="stat-value">${stats.overall_average.toFixed(1)}%</div>
            <div class="stat-label">Overall Average</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.completed_assignments}/${stats.total_assignments}</div>
            <div class="stat-label">Assignments Completed</div>
          </div>
        </div>

        <div class="grades-section">
          <div class="section-title">Academic Performance</div>
          <table class="grades-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Date</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${grades.map(grade => `
                <tr>
                  <td>${grade.assignment}</td>
                  <td>${formatDate(grade.date)}</td>
                  <td>${grade.grade}/${grade.max_score}</td>
                  <td>${grade.percentage.toFixed(1)}%</td>
                  <td class="grade-${grade.percentage >= 90 ? 'excellent' : grade.percentage >= 80 ? 'good' : grade.percentage >= 70 ? 'fair' : 'poor'}">
                    ${getGradeLetter(grade.percentage)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="signature-section">
          <div class="signature">
            <div class="signature-line">Teacher Signature</div>
          </div>
          <div class="signature">
            <div class="signature-line">Principal Signature</div>
          </div>
          <div class="signature">
            <div class="signature-line">Parent Signature</div>
          </div>
        </div>

        <div class="footer">
          Generated on ${formatDate(new Date().toISOString())} • Physics Learning Platform
        </div>
      </body>
      </html>
    `;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.schoolName}>{school.name}</Text>
        <Text style={styles.reportTitle}>Student Progress Report</Text>
        <Text style={styles.period}>
          {period.term} • {formatDate(period.start_date)} - {formatDate(period.end_date)}
        </Text>
        
        <View style={styles.actionButtons}>
          {onDownload && (
            <TouchableOpacity style={styles.actionButton} onPress={onDownload}>
              <Ionicons name="download" size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Download PDF</Text>
            </TouchableOpacity>
          )}
          {onShare && (
            <TouchableOpacity style={styles.actionButton} onPress={onShare}>
              <Ionicons name="share" size={20} color={colors.primary} />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Student Info */}
      <View style={styles.studentInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Student Name:</Text>
          <Text style={styles.infoValue}>{student.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Student ID:</Text>
          <Text style={styles.infoValue}>{student.student_id || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Grade Level:</Text>
          <Text style={styles.infoValue}>{student.grade_level || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email:</Text>
          <Text style={styles.infoValue}>{student.email}</Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryStats}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: getGradeColor(stats.overall_average) }]}>
            {stats.overall_average.toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Overall Average</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {stats.completed_assignments}/{stats.total_assignments}
          </Text>
          <Text style={styles.statLabel}>Assignments Completed</Text>
        </View>
      </View>

      {/* Grades Table */}
      <View style={styles.gradesSection}>
        <Text style={styles.sectionTitle}>Academic Performance</Text>
        
        <View style={styles.gradesTable}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Assignment</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Date</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Score</Text>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grade</Text>
          </View>
          
          {grades.map((grade, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.tableCellText, { flex: 2 }]} numberOfLines={2}>
                {grade.assignment}
              </Text>
              <Text style={[styles.tableCellText, { flex: 1 }]}>
                {formatDate(grade.date)}
              </Text>
              <Text style={[styles.tableCellText, { flex: 1 }]}>
                {grade.grade}/{grade.max_score}
              </Text>
              <Text style={[
                styles.tableCellText, 
                { flex: 1, color: getGradeColor(grade.percentage), fontWeight: 'bold' }
              ]}>
                {getGradeLetter(grade.percentage)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Generated on {formatDate(new Date().toISOString())}
        </Text>
        <Text style={styles.footerText}>Physics Learning Platform</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card.background,
  },
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
    backgroundColor: colors.background,
  },
  schoolName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 20,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  period: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  studentInfo: {
    backgroundColor: colors.background,
    padding: Spacing.xl,
    margin: Spacing.lg,
    borderRadius: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  infoLabel: {
    fontWeight: '600',
    color: colors.primary,
    flex: 1,
  },
  infoValue: {
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  summaryStats: {
    flexDirection: 'row',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background,
    padding: Spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  gradesSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: Spacing.lg,
    paddingBottom: 5,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  gradesTable: {
    backgroundColor: colors.background,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  tableHeaderText: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 14,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tableCellText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  footer: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginTop: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
});