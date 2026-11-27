import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WeeklyReport, ReportEditLog, ReportPeriod } from '../types';
import { generateId } from '../utils/calculations';
import { migrateReport } from '../utils/wheely';
import { initializeDemoData } from '../utils/demoData';
import { periodOf, samePeriod, periodDuplicateMessage } from '../utils/period';

interface DataContextType {
  reports: WeeklyReport[];
  editLogs: ReportEditLog[];
  addReport: (report: Omit<WeeklyReport, 'id' | 'created_at' | 'updated_at'>) => { success: boolean; error?: string };
  updateReport: (id: string, data: Partial<WeeklyReport>, changedByUserId: string) => void;
  deleteReport: (id: string) => void;
  getReportById: (id: string) => WeeklyReport | undefined;
  getReportsByUser: (userId: string) => WeeklyReport[];
  getEditLogsByReport: (reportId: string) => ReportEditLog[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const REPORTS_KEY = 'taxi_reports';
const LOGS_KEY = 'taxi_edit_logs';

// Отчёты одного «вида» (недельные или дневные) — одна и та же структура и логика,
// различается только поле period (записи без period считаются недельными).
export function filterByPeriod(reports: WeeklyReport[], kind: ReportPeriod): WeeklyReport[] {
  return reports.filter(r => periodOf(r) === kind);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [editLogs, setEditLogs] = useState<ReportEditLog[]>([]);

  useEffect(() => {
    initializeDemoData();
    const stored = localStorage.getItem(REPORTS_KEY);
    if (stored) setReports(JSON.parse(stored).map(migrateReport));
    const logs = localStorage.getItem(LOGS_KEY);
    if (logs) setEditLogs(JSON.parse(logs));
  }, []);

  const persistReports = (data: WeeklyReport[]) => {
    setReports(data);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(data));
  };

  const persistLogs = (data: ReportEditLog[]) => {
    setEditLogs(data);
    localStorage.setItem(LOGS_KEY, JSON.stringify(data));
  };

  const addReport = (report: Omit<WeeklyReport, 'id' | 'created_at' | 'updated_at'>) => {
    const kind = periodOf(report as WeeklyReport);
    const newLike = report as WeeklyReport;
    const existing = reports.find(
      r => r.user_id === report.user_id && samePeriod(r, newLike)
    );
    if (existing) return { success: false, error: periodDuplicateMessage(kind) };

    const newReport: WeeklyReport = {
      ...report,
      week_number: kind === 'daily' ? 0 : report.week_number,
      month: kind === 'daily' ? report.month : undefined,
      day: kind === 'daily' ? report.day : undefined,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as WeeklyReport;
    persistReports([...reports, newReport]);
    return { success: true };
  };

  const updateReport = (id: string, data: Partial<WeeklyReport>, changedByUserId: string) => {
    const report = reports.find(r => r.id === id);
    if (!report) return;

    const newLogs: ReportEditLog[] = [];
    const fields: (keyof WeeklyReport)[] = [
      'wheely_gross', 'wheely_agent_fee', 'wheely_airport_parking', 'sober_driver', 'wheely_tips',
      'grnz', 'mileage', 'car',
      'yandex_gross', 'yandex_tips', 'zsd', 'own_rent_gross', 'zsd_own_rent', 'hourly_rent_hours',
      'compensations', 'bonuses', 'adjustmentBonuses', 'fines', 'zsdPayout', 'comment', 'total_driver_payout'
    ];

    // Смена периода тоже попадает в аудит-лог (для дневных — дата, для недельных — диапазон недель)
    const periodChanged = data.period !== undefined || data.year !== undefined
      || data.week_number !== undefined || data.month !== undefined || data.day !== undefined;
    if (periodChanged) {
      const nextKind = periodOf({ ...report, ...data } as WeeklyReport);
      const before = periodOf(report) === 'daily' ? `${report.year}.${report.month}.${report.day}` : `${report.year}/W${report.week_number}`;
      const nr = { ...report, ...data } as WeeklyReport;
      const after = nextKind === 'daily' ? `${nr.year}.${nr.month}.${nr.day}` : `${nr.year}/W${nr.week_number}`;
      if (before !== after) {
        newLogs.push({
          id: generateId(),
          report_id: id,
          changed_by_user_id: changedByUserId,
          field_name: 'period',
          old_value: before,
          new_value: after,
          changed_at: new Date().toISOString()
        });
      }
    }

    fields.forEach(field => {
      if (data[field] !== undefined && data[field] !== report[field]) {
        newLogs.push({
          id: generateId(),
          report_id: id,
          changed_by_user_id: changedByUserId,
          field_name: field,
          old_value: String(report[field]),
          new_value: String(data[field]),
          changed_at: new Date().toISOString()
        });
      }
    });

    if (newLogs.length > 0) {
      persistLogs([...editLogs, ...newLogs]);
    }

    const updated = reports.map(r =>
      r.id === id ? { ...r, ...data, updated_at: new Date().toISOString() } : r
    );
    persistReports(updated);
  };

  const deleteReport = (id: string) => {
    persistReports(reports.filter(r => r.id !== id));
    persistLogs(editLogs.filter(l => l.report_id !== id));
  };

  const getReportById = (id: string) => reports.find(r => r.id === id);
  const getReportsByUser = (userId: string) => reports.filter(r => r.user_id === userId);
  const getEditLogsByReport = (reportId: string) => editLogs.filter(l => l.report_id === reportId);

  return (
    <DataContext.Provider value={{
      reports, editLogs, addReport, updateReport, deleteReport,
      getReportById, getReportsByUser, getEditLogsByReport
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
