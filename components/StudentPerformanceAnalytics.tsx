import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Circle,
  Line,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/Colors';
import { Spacing } from '../constants/Styles';
import Card from './Card';
import Button from './Button';
import {
  getStudentTestResults,
  addStudentTestResult,
  updateStudentTestResult,
  deleteStudentTestResult,
  getStudentAttendanceSummary,
  getStudentSubmissions,
  getAssignmentsBySchool,
} from '../lib/database';
import { uploadFileToSupabase, generateFilePath } from '../lib/fileUpload';
import { exportToCSV } from '../lib/csvExport';
import { supabase } from '../lib/supabase';

interface StudentPerformanceAnalyticsProps {
  student: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    school_id?: string;
    school?: { name: string };
  };
  isTeacherOrAdmin?: boolean;
  totalAssignments?: number;
  submittedAssignments?: number;
  onRefreshParent?: () => void;
}

type TimeframeType = 'all' | '30d' | '3m' | '6m';
type GraphTabType = 'tests' | 'attendance' | 'submissions';

export default function StudentPerformanceAnalytics({
  student,
  isTeacherOrAdmin = false,
  totalAssignments: propTotalAssignments = 0,
  submittedAssignments: propSubmittedAssignments = 0,
  onRefreshParent,
}: StudentPerformanceAnalyticsProps) {
  // Active states
  const [activeTab, setActiveTab] = useState<GraphTabType>('tests');
  const [timeframe, setTimeframe] = useState<TimeframeType>('all');
  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);

  // Data states
  const [testResults, setTestResults] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<{
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    attendanceRate: number;
    history: Array<{ date: string; status: string; note?: string }>;
  }>({
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
    attendanceRate: 100,
    history: [],
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Add / Edit Test Result
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testTitle, setTestTitle] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [scoreStr, setScoreStr] = useState('');
  const [maxScoreStr, setMaxScoreStr] = useState('100');
  const [testNotes, setTestNotes] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<any | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [savingTest, setSavingTest] = useState(false);

  // Responsive Chart width
  const [chartWidth, setChartWidth] = useState(360);

  useEffect(() => {
    if (student?.id) {
      loadData();
    }
  }, [student?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const promises: Promise<any>[] = [
        getStudentTestResults(student.id),
        getStudentAttendanceSummary(student.id),
        getStudentSubmissions(student.id),
      ];

      if (student.school_id) {
        promises.push(getAssignmentsBySchool(student.school_id));
      }

      const results = await Promise.all(promises);

      const testsRes = results[0];
      const attRes = results[1];
      const subRes = results[2];
      const assignRes = results[3];

      if (testsRes?.data) setTestResults(testsRes.data);
      if (attRes) setAttendanceStats(attRes);
      if (subRes?.data) setSubmissions(subRes.data);
      if (assignRes?.data) setAssignments(assignRes.data);
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper date cutoff based on timeframe
  const cutoffDate = useMemo(() => {
    if (timeframe === 'all') return null;
    const now = new Date();
    const cutoff = new Date();
    if (timeframe === '30d') cutoff.setDate(now.getDate() - 30);
    else if (timeframe === '3m') cutoff.setMonth(now.getMonth() - 3);
    else if (timeframe === '6m') cutoff.setMonth(now.getMonth() - 6);
    return cutoff;
  }, [timeframe]);

  // 1. FILTERED TEST RESULTS
  const filteredTests = useMemo(() => {
    if (!testResults || testResults.length === 0) return [];
    if (!cutoffDate) return testResults;
    return testResults.filter((t) => new Date(t.test_date) >= cutoffDate);
  }, [testResults, cutoffDate]);

  const testStats = useMemo(() => {
    if (filteredTests.length === 0) {
      return { avg: 0, high: 0, low: 0, total: 0 };
    }
    const scores = filteredTests.map((t) => Number(t.percentage) || 0);
    const total = scores.length;
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / total);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    return { avg, high, low, total };
  }, [filteredTests]);

  // 2. FILTERED ATTENDANCE SESSIONS & RATE EVOLUTION
  const filteredAttendance = useMemo(() => {
    if (!attendanceStats.history || attendanceStats.history.length === 0) return [];
    // Sort chronological: oldest to newest
    const sorted = [...attendanceStats.history].sort((a, b) => a.date.localeCompare(b.date));
    if (!cutoffDate) return sorted;
    return sorted.filter((s) => new Date(s.date) >= cutoffDate);
  }, [attendanceStats.history, cutoffDate]);

  const attendanceFilteredStats = useMemo(() => {
    let p = 0;
    let a = 0;
    let l = 0;
    let e = 0;
    filteredAttendance.forEach((item) => {
      const s = (item.status || '').toLowerCase();
      if (s === 'present') p++;
      else if (s === 'absent') a++;
      else if (s === 'late') l++;
      else if (s === 'excused') e++;
      else p++;
    });
    const total = p + a + l + e;
    const rate = total > 0 ? Math.round(((p + l) / total) * 100) : 100;
    return { present: p, absent: a, late: l, excused: e, total, rate };
  }, [filteredAttendance]);

  // 3. FILTERED ASSIGNMENTS & SUBMISSION TIMELINE
  const filteredAssignmentTimeline = useMemo(() => {
    const list = assignments.length > 0 ? assignments : submissions.map((s) => s.assignment).filter(Boolean);
    if (!list || list.length === 0) return [];

    // Map each assignment with student submission status
    const mapped = list.map((assignment: any) => {
      const sub = submissions.find((s: any) => s.assignment_id === assignment.id);
      const isSubmitted = !!sub;
      const grade = sub && sub.grade !== null && sub.grade !== undefined ? Number(sub.grade) : null;
      const maxScore = Number(assignment.max_score) || 100;
      const pct = grade !== null ? Math.round((grade / maxScore) * 100) : isSubmitted ? 100 : 0;
      const date = sub?.submitted_at
        ? sub.submitted_at.split('T')[0]
        : assignment.due_date
        ? assignment.due_date.split('T')[0]
        : assignment.created_at
        ? assignment.created_at.split('T')[0]
        : '2026-01-01';

      return {
        id: assignment.id,
        title: assignment.title,
        date,
        due_date: assignment.due_date,
        isSubmitted,
        submitted_at: sub?.submitted_at,
        grade,
        maxScore,
        pct,
        feedback: sub?.feedback || '',
      };
    });

    // Sort chronological
    const sorted = mapped.sort((a, b) => a.date.localeCompare(b.date));
    if (!cutoffDate) return sorted;
    return sorted.filter((item) => new Date(item.date) >= cutoffDate);
  }, [assignments, submissions, cutoffDate]);

  const assignmentFilteredStats = useMemo(() => {
    const total = filteredAssignmentTimeline.length;
    const submitted = filteredAssignmentTimeline.filter((a) => a.isSubmitted).length;
    const missing = total - submitted;
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    const graded = filteredAssignmentTimeline.filter((a) => a.grade !== null);
    const avgGrade =
      graded.length > 0
        ? Math.round(graded.reduce((acc, curr) => acc + curr.pct, 0) / graded.length)
        : 0;

    return { total, submitted, missing, rate, avgGrade, gradedCount: graded.length };
  }, [filteredAssignmentTimeline]);

  // SVG Geometry Settings
  const chartHeight = 210;
  const paddingLeft = 40;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = Math.max(100, chartWidth - paddingLeft - paddingRight);
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // --------------------------------------------------------------------------
  // CHART 1: TEST RESULTS SVG GEOMETRY
  // --------------------------------------------------------------------------
  const testsChartData = useMemo(() => {
    if (filteredTests.length === 0) return null;

    const points = filteredTests.map((item, index) => {
      const pct = Math.min(100, Math.max(0, Number(item.percentage) || 0));
      const x =
        filteredTests.length === 1
          ? paddingLeft + innerWidth / 2
          : paddingLeft + (index / (filteredTests.length - 1)) * innerWidth;
      const y = paddingTop + innerHeight - (pct / 100) * innerHeight;

      let isDrop = false;
      let dropDiff = 0;
      if (index > 0) {
        const prevPct = Number(filteredTests[index - 1].percentage) || 0;
        if (pct < prevPct && prevPct - pct >= 8) {
          isDrop = true;
          dropDiff = Math.round(prevPct - pct);
        }
      }

      return {
        ...item,
        x,
        y,
        pct,
        isDrop,
        dropDiff,
        index,
        displayDate: item.test_date ? item.test_date.slice(5) : '',
        type: 'test',
      };
    });

    let pathD = '';
    let areaD = '';
    if (points.length === 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      areaD = '';
    } else {
      pathD = points.reduce((acc, curr, idx) => {
        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
      }, '');
      const last = points[points.length - 1];
      const first = points[0];
      const baselineY = paddingTop + innerHeight;
      areaD = `${pathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
    }

    return { points, pathD, areaD };
  }, [filteredTests, chartWidth, innerWidth, innerHeight]);

  // --------------------------------------------------------------------------
  // CHART 2: ATTENDANCE TREND SVG GEOMETRY
  // --------------------------------------------------------------------------
  const attendanceChartData = useMemo(() => {
    if (filteredAttendance.length === 0) return null;

    let runningPresent = 0;
    const points = filteredAttendance.map((item, index) => {
      const s = (item.status || '').toLowerCase();
      if (s === 'present' || s === 'late') {
        runningPresent++;
      }
      const runningRate = Math.round((runningPresent / (index + 1)) * 100);

      const x =
        filteredAttendance.length === 1
          ? paddingLeft + innerWidth / 2
          : paddingLeft + (index / (filteredAttendance.length - 1)) * innerWidth;
      const y = paddingTop + innerHeight - (runningRate / 100) * innerHeight;

      const isAbsent = s === 'absent';
      const isLate = s === 'late';
      const isExcused = s === 'excused';

      return {
        ...item,
        x,
        y,
        pct: runningRate,
        isAbsent,
        isLate,
        isExcused,
        index,
        displayDate: item.date ? item.date.slice(5) : '',
        type: 'attendance',
      };
    });

    let pathD = '';
    let areaD = '';
    if (points.length === 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
    } else {
      pathD = points.reduce((acc, curr, idx) => {
        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
      }, '');
      const last = points[points.length - 1];
      const first = points[0];
      const baselineY = paddingTop + innerHeight;
      areaD = `${pathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
    }

    return { points, pathD, areaD };
  }, [filteredAttendance, chartWidth, innerWidth, innerHeight]);

  // --------------------------------------------------------------------------
  // CHART 3: SUBMISSIONS TREND SVG GEOMETRY
  // --------------------------------------------------------------------------
  const submissionsChartData = useMemo(() => {
    if (filteredAssignmentTimeline.length === 0) return null;

    const points = filteredAssignmentTimeline.map((item, index) => {
      const pct = Math.min(100, Math.max(0, item.pct));
      const x =
        filteredAssignmentTimeline.length === 1
          ? paddingLeft + innerWidth / 2
          : paddingLeft + (index / (filteredAssignmentTimeline.length - 1)) * innerWidth;
      const y = paddingTop + innerHeight - (pct / 100) * innerHeight;

      return {
        ...item,
        x,
        y,
        pct,
        index,
        displayDate: item.date ? item.date.slice(5) : '',
        type: 'submission',
      };
    });

    let pathD = '';
    let areaD = '';
    if (points.length === 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
    } else {
      pathD = points.reduce((acc, curr, idx) => {
        return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
      }, '');
      const last = points[points.length - 1];
      const first = points[0];
      const baselineY = paddingTop + innerHeight;
      areaD = `${pathD} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
    }

    return { points, pathD, areaD };
  }, [filteredAssignmentTimeline, chartWidth, innerWidth, innerHeight]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingId(null);
    setTestTitle('');
    setTestDate(new Date().toISOString().split('T')[0]);
    setScoreStr('');
    setMaxScoreStr('100');
    setTestNotes('');
    setSelectedPdf(null);
    setExistingPdfUrl(null);
    setModalVisible(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingId(item.id);
    setTestTitle(item.title);
    setTestDate(item.test_date || new Date().toISOString().split('T')[0]);
    setScoreStr(String(item.score));
    setMaxScoreStr(String(item.max_score || 100));
    setTestNotes(item.notes || '');
    setSelectedPdf(null);
    setExistingPdfUrl(item.pdf_url || null);
    setModalVisible(true);
  };

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        if (file.size && file.size > 50 * 1024 * 1024) {
          Alert.alert('File Too Large', 'PDF must be under 50MB.');
          return;
        }
        setSelectedPdf(file);
      }
    } catch (err) {
      console.error('Pick PDF error:', err);
      Alert.alert('Error', 'Failed to select PDF file.');
    }
  };

  const handleSaveTestResult = async () => {
    if (!testTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a test title.');
      return;
    }

    const numScore = parseFloat(scoreStr);
    const numMax = parseFloat(maxScoreStr);

    if (isNaN(numScore) || numScore < 0) {
      Alert.alert('Invalid Score', 'Please enter a valid numeric student score.');
      return;
    }

    if (isNaN(numMax) || numMax <= 0) {
      Alert.alert('Invalid Max Score', 'Max score must be greater than 0.');
      return;
    }

    setSavingTest(true);

    try {
      let finalPdfUrl = existingPdfUrl;
      let finalPdfPath = undefined;

      if (selectedPdf) {
        const path = generateFilePath('test-results', student.id, selectedPdf.name, 'tests');
        let uploadFileObj: any;
        if (Platform.OS === 'web' && (selectedPdf as any).file) {
          uploadFileObj = (selectedPdf as any).file;
        } else {
          uploadFileObj = {
            uri: selectedPdf.uri,
            name: selectedPdf.name,
            mimeType: 'application/pdf',
            size: selectedPdf.size,
          };
        }

        const uploadRes = await uploadFileToSupabase(uploadFileObj, 'materials', path);
        if (uploadRes.success) {
          const { data: pubData } = supabase.storage.from('materials').getPublicUrl(path);
          finalPdfUrl = pubData?.publicUrl || null;
          finalPdfPath = path;
        }
      }

      if (editingId) {
        const { error } = await updateStudentTestResult(editingId, {
          title: testTitle.trim(),
          test_date: testDate,
          score: numScore,
          max_score: numMax,
          notes: testNotes.trim() || undefined,
          pdf_url: finalPdfUrl || undefined,
          pdf_path: finalPdfPath || undefined,
        });
        if (error) throw error;
        Alert.alert('Success', 'Test result updated successfully!');
      } else {
        const { error } = await addStudentTestResult({
          student_id: student.id,
          school_id: student.school_id,
          title: testTitle.trim(),
          test_date: testDate,
          score: numScore,
          max_score: numMax,
          notes: testNotes.trim() || undefined,
          pdf_url: finalPdfUrl || undefined,
          pdf_path: finalPdfPath || undefined,
        });
        if (error) throw error;
        Alert.alert('Success', 'Test result added successfully!');
      }

      setModalVisible(false);
      await loadData();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      console.error('Save test result error:', err);
      Alert.alert('Error', err.message || 'Failed to save test result.');
    } finally {
      setSavingTest(false);
    }
  };

  const handleDeleteTest = (item: any) => {
    Alert.alert('Delete Test Result', `Are you sure you want to delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await deleteStudentTestResult(item.id);
            if (error) throw error;
            await loadData();
            if (onRefreshParent) onRefreshParent();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete test result.');
          }
        },
      },
    ]);
  };

  const handleOpenPdf = (pdfUrl: string) => {
    if (!pdfUrl) return;
    if (Platform.OS === 'web') {
      window.open(pdfUrl, '_blank');
    } else {
      Linking.openURL(pdfUrl).catch(() => {
        Alert.alert('Error', 'Unable to open PDF link.');
      });
    }
  };

  // Print / PDF Export
  const handlePrintReport = () => {
    if (Platform.OS === 'web') {
      window.print();
    } else {
      Alert.alert(
        'Print Report',
        'To print on mobile devices, please export the report via CSV or view via tablet/desktop web.'
      );
    }
  };

  // Comprehensive Whole-Profile CSV Export
  const handleExportFullCSV = async () => {
    try {
      const csvData: any[] = [];

      // Add Test Results Rows
      filteredTests.forEach((t) => {
        csvData.push({
          'Record Type': 'Test Result',
          'Student Name': student.name,
          'Email': student.email || '',
          'Phone': student.phone || '',
          'School': student.school?.name || '',
          'Item Title': t.title,
          'Date': t.test_date,
          'Score / Metric': `${t.score}/${t.max_score}`,
          'Percentage': `${Math.round(t.percentage)}%`,
          'Status': t.percentage >= 85 ? 'Mastery' : t.percentage < 60 ? 'Needs Support' : 'Standard',
          'Notes / Feedback': t.notes || '',
          'Attachment Link': t.pdf_url || '',
        });
      });

      // Add Attendance Records Rows
      filteredAttendance.forEach((att) => {
        csvData.push({
          'Record Type': 'Attendance Session',
          'Student Name': student.name,
          'Email': student.email || '',
          'Phone': student.phone || '',
          'School': student.school?.name || '',
          'Item Title': 'Session Attendance',
          'Date': att.date,
          'Score / Metric': att.status.toUpperCase(),
          'Percentage': att.status === 'present' ? '100%' : att.status === 'late' ? '75%' : '0%',
          'Status': att.status.toUpperCase(),
          'Notes / Feedback': att.note || '',
          'Attachment Link': '',
        });
      });

      // Add Assignment Submissions Rows
      filteredAssignmentTimeline.forEach((assign) => {
        csvData.push({
          'Record Type': 'Assignment Submission',
          'Student Name': student.name,
          'Email': student.email || '',
          'Phone': student.phone || '',
          'School': student.school?.name || '',
          'Item Title': assign.title,
          'Date': assign.date,
          'Score / Metric': assign.grade !== null ? `${assign.grade}/${assign.maxScore}` : assign.isSubmitted ? 'Submitted (Ungraded)' : 'Missing',
          'Percentage': `${assign.pct}%`,
          'Status': assign.isSubmitted ? 'Submitted' : 'Missing',
          'Notes / Feedback': assign.feedback || '',
          'Attachment Link': '',
        });
      });

      const safeName = (student.name || 'Student').replace(/\s+/g, '-');
      await exportToCSV(csvData, `${safeName}-full-profile-analytics`);
      Alert.alert('Success', 'Full student profile and analytics exported to CSV!');
    } catch (err) {
      console.error('Export CSV error:', err);
      Alert.alert('Export Error', 'Failed to generate full CSV export.');
    }
  };

  // Active chart data selector
  const activeChartData =
    activeTab === 'tests'
      ? testsChartData
      : activeTab === 'attendance'
      ? attendanceChartData
      : submissionsChartData;

  const activeGradientId =
    activeTab === 'tests'
      ? 'scoreGradient'
      : activeTab === 'attendance'
      ? 'attendanceGradient'
      : 'submissionsGradient';

  const activeStrokeColor =
    activeTab === 'tests'
      ? Colors.primary
      : activeTab === 'attendance'
      ? '#8B5CF6'
      : Colors.info;

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== chartWidth) setChartWidth(w);
      }}
    >

      {/* TOP HEADER & ACTION BUTTONS */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionHeading}>Performance & Academic Analytics</Text>
          <Text style={styles.sectionSubHeading}>
            Tabbed trend graphs, attendance records & assignments
          </Text>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.exportBtnOutline}
            onPress={handlePrintReport}
            activeOpacity={0.7}
          >
            <Ionicons name="print-outline" size={15} color={Colors.primary} />
            <Text style={styles.exportBtnText}>Print / PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtnOutline}
            onPress={handleExportFullCSV}
            activeOpacity={0.7}
          >
            <Ionicons name="download-outline" size={15} color={Colors.primary} />
            <Text style={styles.exportBtnText}>Export Full Profile (CSV)</Text>
          </TouchableOpacity>

          {isTeacherOrAdmin && (
            <TouchableOpacity
              style={styles.addTestBtn}
              onPress={handleOpenAddModal}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color="#FFFFFF" />
              <Text style={styles.addTestBtnText}>Add Test Result</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TABBED GRAPH CARD */}
      <Card style={styles.chartCard}>
        {/* TAB SWITCHER & TIMEFRAME HEADER */}
        <View style={styles.chartControlHeader}>
          {/* Main Graph Switcher Tabs */}
          <View style={styles.graphTabsContainer}>
            <TouchableOpacity
              style={[styles.graphTab, activeTab === 'tests' && styles.graphTabActive]}
              onPress={() => {
                setActiveTab('tests');
                setSelectedPoint(null);
              }}
            >
              <Ionicons
                name="trending-up"
                size={16}
                color={activeTab === 'tests' ? '#FFFFFF' : Colors.primary}
              />
              <Text
                style={[
                  styles.graphTabText,
                  activeTab === 'tests' && styles.graphTabTextActive,
                ]}
              >
                Test Scores
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.graphTab, activeTab === 'attendance' && styles.graphTabActive]}
              onPress={() => {
                setActiveTab('attendance');
                setSelectedPoint(null);
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={activeTab === 'attendance' ? '#FFFFFF' : '#8B5CF6'}
              />
              <Text
                style={[
                  styles.graphTabText,
                  activeTab === 'attendance' && styles.graphTabTextActive,
                ]}
              >
                Attendance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.graphTab, activeTab === 'submissions' && styles.graphTabActive]}
              onPress={() => {
                setActiveTab('submissions');
                setSelectedPoint(null);
              }}
            >
              <Ionicons
                name="book-outline"
                size={16}
                color={activeTab === 'submissions' ? '#FFFFFF' : Colors.info}
              />
              <Text
                style={[
                  styles.graphTabText,
                  activeTab === 'submissions' && styles.graphTabTextActive,
                ]}
              >
                Submissions
              </Text>
            </TouchableOpacity>
          </View>

          {/* Timeframe Filter Tabs */}
          <View style={styles.timeframeTabs}>
            {(['all', '30d', '3m', '6m'] as TimeframeType[]).map((tf) => {
              const labels: Record<TimeframeType, string> = {
                all: 'All Time',
                '30d': '30 Days',
                '3m': '3 Mos',
                '6m': '6 Mos',
              };
              const isActive = timeframe === tf;
              return (
                <TouchableOpacity
                  key={tf}
                  style={[styles.timeframeBtn, isActive && styles.timeframeBtnActive]}
                  onPress={() => {
                    setTimeframe(tf);
                    setSelectedPoint(null);
                  }}
                >
                  <Text
                    style={[
                      styles.timeframeBtnText,
                      isActive && styles.timeframeBtnTextActive,
                    ]}
                  >
                    {labels[tf]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* DYNAMIC METRICS SUMMARY BAR (BASED ON ACTIVE TAB) */}
        {activeTab === 'tests' && (
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{testStats.avg}%</Text>
              <Text style={styles.metricLbl}>Average Score</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.success }]}>{testStats.high}%</Text>
              <Text style={styles.metricLbl}>Highest Score</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text
                style={[
                  styles.metricVal,
                  { color: testStats.low < 60 ? Colors.error : Colors.warning },
                ]}
              >
                {testStats.low}%
              </Text>
              <Text style={styles.metricLbl}>Lowest Score</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{testStats.total}</Text>
              <Text style={styles.metricLbl}>Tests Taken</Text>
            </View>
          </View>
        )}

        {activeTab === 'attendance' && (
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#8B5CF6' }]}>
                {attendanceFilteredStats.rate}%
              </Text>
              <Text style={styles.metricLbl}>Attendance Rate</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.success }]}>
                {attendanceFilteredStats.present}
              </Text>
              <Text style={styles.metricLbl}>Present</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.error }]}>
                {attendanceFilteredStats.absent}
              </Text>
              <Text style={styles.metricLbl}>Absent</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: '#8B5CF6' }]}>
                {attendanceFilteredStats.late}
              </Text>
              <Text style={styles.metricLbl}>Late</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.warning }]}>
                {attendanceFilteredStats.excused}
              </Text>
              <Text style={styles.metricLbl}>Excused</Text>
            </View>
          </View>
        )}

        {activeTab === 'submissions' && (
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.info }]}>
                {assignmentFilteredStats.rate}%
              </Text>
              <Text style={styles.metricLbl}>Completion Rate</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.success }]}>
                {assignmentFilteredStats.submitted}
              </Text>
              <Text style={styles.metricLbl}>Submitted</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.error }]}>
                {assignmentFilteredStats.missing}
              </Text>
              <Text style={styles.metricLbl}>Missing</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{assignmentFilteredStats.avgGrade}%</Text>
              <Text style={styles.metricLbl}>Average Grade</Text>
            </View>
          </View>
        )}

        {/* SELECTED POINT TOOLTIP */}
        {selectedPoint && (
          <View style={styles.tooltipBox}>
            <View style={styles.tooltipHeader}>
              <Text style={styles.tooltipTitle}>
                {selectedPoint.title ||
                  (selectedPoint.type === 'attendance'
                    ? `Session: ${selectedPoint.status.toUpperCase()}`
                    : 'Activity')}
              </Text>
              <Text style={styles.tooltipScore}>
                {selectedPoint.type === 'test'
                  ? `${selectedPoint.score}/${selectedPoint.max_score} (${selectedPoint.pct}%)`
                  : selectedPoint.type === 'attendance'
                  ? `Status: ${selectedPoint.status.toUpperCase()}`
                  : selectedPoint.isSubmitted
                  ? `Submitted (${selectedPoint.pct}%)`
                  : 'Missing (0%)'}
              </Text>
            </View>

            <Text style={styles.tooltipDate}>
              Date: {new Date(selectedPoint.date || selectedPoint.test_date).toLocaleDateString()}
            </Text>

            {selectedPoint.isDrop && (
              <View style={styles.dropAlertRow}>
                <Ionicons name="arrow-down-circle" size={14} color={Colors.error} />
                <Text style={styles.dropAlertText}>
                  Score dropped by {selectedPoint.dropDiff}% compared to previous test!
                </Text>
              </View>
            )}

            {selectedPoint.notes || selectedPoint.note || selectedPoint.feedback ? (
              <Text style={styles.tooltipNotes}>
                "{selectedPoint.notes || selectedPoint.note || selectedPoint.feedback}"
              </Text>
            ) : null}
          </View>
        )}

        {/* SVG GRAPH RENDERING */}
        {loading ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.chartLoadingText}>Loading graph analytics...</Text>
          </View>
        ) : !activeChartData || activeChartData.points.length === 0 ? (
          <View style={styles.emptyChart}>
            <Ionicons name="bar-chart-outline" size={36} color={Colors.text.tertiary} />
            <Text style={styles.emptyChartTitle}>No Data Recorded in this Timeframe</Text>
            <Text style={styles.emptyChartDesc}>
              {activeTab === 'tests'
                ? isTeacherOrAdmin
                  ? 'Click "Add Test Result" above to record student marks.'
                  : 'Your teacher has not uploaded test results for this period.'
                : activeTab === 'attendance'
                ? 'No attendance records logged in this timeframe.'
                : 'No assignments assigned in this timeframe.'}
            </Text>
          </View>
        ) : (
          <View style={styles.svgWrapper}>
            <Svg width={chartWidth} height={chartHeight}>
              <Defs>
                <LinearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0.01" />
                </LinearGradient>
                <LinearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                  <Stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.01" />
                </LinearGradient>
                <LinearGradient id="submissionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={Colors.info} stopOpacity="0.25" />
                  <Stop offset="100%" stopColor={Colors.info} stopOpacity="0.01" />
                </LinearGradient>
              </Defs>

              {/* Grid Lines (0%, 25%, 50%, 75%, 100%) */}
              {[0, 25, 50, 75, 100].map((level) => {
                const y = paddingTop + innerHeight - (level / 100) * innerHeight;
                return (
                  <G key={`grid-${level}`}>
                    <Line
                      x1={paddingLeft}
                      y1={y}
                      x2={paddingLeft + innerWidth}
                      y2={y}
                      stroke="rgba(0, 31, 63, 0.08)"
                      strokeDasharray="4, 4"
                      strokeWidth="1"
                    />
                    <SvgText
                      x={paddingLeft - 6}
                      y={y + 3}
                      fill="#888888"
                      fontSize="9"
                      textAnchor="end"
                    >
                      {level}%
                    </SvgText>
                  </G>
                );
              })}

              {/* Gradient Area under line */}
              {activeChartData.areaD ? (
                <Path d={activeChartData.areaD} fill={`url(#${activeGradientId})`} />
              ) : null}

              {/* Connecting Polyline */}
              {activeChartData.pathD ? (
                <Path
                  d={activeChartData.pathD}
                  fill="none"
                  stroke={activeStrokeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}

              {/* Render Nodes */}
              {activeChartData.points.map((pt, idx) => {
                const isSelected = selectedPoint?.index === pt.index && selectedPoint?.type === pt.type;
                let pointColor = activeStrokeColor;

                if (activeTab === 'tests') {
                  pointColor = pt.isDrop ? Colors.error : pt.pct >= 85 ? Colors.success : Colors.primary;
                } else if (activeTab === 'attendance') {
                  pointColor = pt.isAbsent
                    ? Colors.error
                    : pt.isLate
                    ? '#8B5CF6'
                    : pt.isExcused
                    ? Colors.warning
                    : Colors.success;
                } else if (activeTab === 'submissions') {
                  pointColor = !pt.isSubmitted ? Colors.error : pt.pct >= 85 ? Colors.success : Colors.info;
                }

                return (
                  <G key={`pt-${idx}`}>
                    {(pt.isDrop || isSelected) && (
                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 9 : 7}
                        fill={pt.isDrop ? 'rgba(255, 59, 48, 0.25)' : 'rgba(0, 31, 63, 0.15)'}
                      />
                    )}

                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r="5"
                      fill="#FFFFFF"
                      stroke={pointColor}
                      strokeWidth="2.5"
                    />

                    {/* Percentage Score Label on Top */}
                    <SvgText
                      x={pt.x}
                      y={pt.y - 8}
                      fill={pointColor}
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {Math.round(pt.pct)}%
                    </SvgText>

                    {/* Date label on bottom axis */}
                    <SvgText
                      x={pt.x}
                      y={paddingTop + innerHeight + 15}
                      fill="#666666"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      {pt.displayDate}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>

            {/* Clickable Overlay Hit Areas for Tooltip Inspection */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
              {activeChartData.points.map((pt) => (
                <TouchableOpacity
                  key={`hit-${pt.index}`}
                  activeOpacity={0.6}
                  style={{
                    position: 'absolute',
                    left: pt.x - 18,
                    top: pt.y - 18,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                  }}
                  onPress={() => setSelectedPoint(pt)}
                />
              ))}
            </View>
          </View>
        )}

        {/* CHART LEGEND ROW */}
        <View style={styles.chartLegendRow}>
          {activeTab === 'tests' && (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>High / Mastery (≥85%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Standard Score</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.legendText}>Grade Drop Point</Text>
              </View>
            </>
          )}

          {activeTab === 'attendance' && (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendText}>Late</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
                <Text style={styles.legendText}>Excused</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.legendText}>Absent</Text>
              </View>
            </>
          )}

          {activeTab === 'submissions' && (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>Submitted / Mastered</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
                <Text style={styles.legendText}>Standard Submission</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.error }]} />
                <Text style={styles.legendText}>Missing Assignment</Text>
              </View>
            </>
          )}
        </View>
      </Card>

      {/* DETAILED TEST RESULTS LIST */}
      <Card style={styles.resultsCard}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderTitleWrap}>
            <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>Test Results History ({filteredTests.length})</Text>
          </View>
        </View>

        {filteredTests.length === 0 ? (
          <Text style={styles.noTestsText}>No tests recorded yet.</Text>
        ) : (
          <View style={styles.testsList}>
            {filteredTests.map((t, idx) => {
              const isDrop = t.percentage < 60;
              const isExcellent = t.percentage >= 85;
              const badgeBg = isExcellent
                ? Colors.success + '20'
                : isDrop
                ? Colors.error + '20'
                : Colors.info + '20';
              const badgeColor = isExcellent
                ? Colors.success
                : isDrop
                ? Colors.error
                : Colors.info;

              return (
                <View key={t.id || idx} style={styles.testItem}>
                  <View style={styles.testItemMain}>
                    <View style={styles.testHeaderRow}>
                      <Text style={styles.testItemTitle}>{t.title}</Text>
                      <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.badgeText, { color: badgeColor }]}>
                          {t.score}/{t.max_score} ({Math.round(t.percentage)}%)
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.testItemDate}>
                      Date: {new Date(t.test_date).toLocaleDateString()}
                    </Text>

                    {t.notes ? (
                      <View style={styles.notesBox}>
                        <Ionicons name="chatbubble-ellipses-outline" size={14} color="#666" />
                        <Text style={styles.notesText}>{t.notes}</Text>
                      </View>
                    ) : null}

                    {t.pdf_url ? (
                      <TouchableOpacity
                        style={styles.pdfAttachmentBtn}
                        onPress={() => handleOpenPdf(t.pdf_url)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-attach" size={16} color={Colors.primary} />
                        <Text style={styles.pdfAttachmentText}>View Marked Exam PDF</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {isTeacherOrAdmin && (
                    <View style={styles.testItemActions}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleOpenEditModal(t)}
                        accessibilityLabel="Edit Result"
                      >
                        <Ionicons name="create-outline" size={18} color={Colors.info} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => handleDeleteTest(t)}
                        accessibilityLabel="Delete Result"
                      >
                        <Ionicons name="trash-outline" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* MODAL: ADD / EDIT TEST RESULT */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Edit Test Result' : 'Upload Test Result'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>Test Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Kinematics Midterm Exam"
                value={testTitle}
                onChangeText={setTestTitle}
              />

              <Text style={styles.formLabel}>Test Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-10-23"
                value={testDate}
                onChangeText={setTestDate}
              />

              <View style={styles.scoreRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formLabel}>Student Score *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 45"
                    keyboardType="numeric"
                    value={scoreStr}
                    onChangeText={setScoreStr}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.formLabel}>Max Score *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="100"
                    keyboardType="numeric"
                    value={maxScoreStr}
                    onChangeText={setMaxScoreStr}
                  />
                </View>
              </View>

              <Text style={styles.formLabel}>Teacher Feedback / Remarks</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Notes on student performance, mistakes or strong points..."
                multiline={true}
                numberOfLines={3}
                value={testNotes}
                onChangeText={setTestNotes}
              />

              <Text style={styles.formLabel}>Attach Exam Sheet / Marked PDF (Optional)</Text>
              <TouchableOpacity
                style={styles.pickPdfButton}
                onPress={handlePickPdf}
                activeOpacity={0.8}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                <Text style={styles.pickPdfButtonText}>
                  {selectedPdf
                    ? `Selected: ${selectedPdf.name}`
                    : existingPdfUrl
                    ? 'Replace Existing PDF Exam Paper'
                    : 'Select PDF Document'}
                </Text>
              </TouchableOpacity>
              {selectedPdf && (
                <Text style={styles.pdfSizeText}>
                  Size: {Math.round((selectedPdf.size || 0) / 1024)} KB
                </Text>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title={savingTest ? 'Saving...' : editingId ? 'Update Result' : 'Upload Result'}
                onPress={handleSaveTestResult}
                disabled={savingTest}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sectionSubHeading: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exportBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: '#FFFFFF',
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  addTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  addTestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chartCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  chartControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  graphTabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 2,
  },
  graphTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  graphTabActive: {
    backgroundColor: Colors.primary,
  },
  graphTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  graphTabTextActive: {
    color: '#FFFFFF',
  },
  timeframeTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  timeframeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timeframeBtnActive: {
    backgroundColor: Colors.primary,
  },
  timeframeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  timeframeBtnTextActive: {
    color: '#FFFFFF',
  },
  metricsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingVertical: 10,
    marginVertical: Spacing.xs,
    flexWrap: 'wrap',
    gap: 8,
  },
  metricItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metricLbl: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.medium,
  },
  tooltipBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tooltipScore: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  tooltipDate: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  dropAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  dropAlertText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  tooltipNotes: {
    color: '#CBD5E1',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  svgWrapper: {
    position: 'relative',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  chartLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  chartLoadingText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  emptyChart: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  emptyChartDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: Spacing.xs,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  resultsCard: {
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginBottom: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  noTestsText: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  testsList: {
    marginTop: Spacing.xs,
    gap: 10,
  },
  testItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  testItemMain: {
    flex: 1,
  },
  testHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  testItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  testItemDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 6,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text.primary,
    flex: 1,
  },
  pdfAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.primary + '10',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pdfAttachmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  testItemActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalBody: {
    padding: Spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border.medium,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text.primary,
    backgroundColor: '#FFFFFF',
  },
  scoreRow: {
    flexDirection: 'row',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pickPdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: Colors.primary + '08',
    justifyContent: 'center',
    marginTop: 4,
  },
  pickPdfButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  pdfSizeText: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    backgroundColor: Colors.background,
  },
});
