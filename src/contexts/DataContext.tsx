import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WeeklyReport, ReportEditLog } from '../types';
import { generateId } from '../utils/calculations';
import { migrateReport } from '../utils/wheely';
import { initializeDemoData } from '../utils/demoData';

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
    const existing = reports.find(
      r => r.user_id === report.user_id && r.year === report.year && r.week_number === report.week_number
    );
    if (existing) return { success: false, error: 'Отчёт за эту неделю уже существует' };

    const newReport: WeeklyReport = {
      ...report,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
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
