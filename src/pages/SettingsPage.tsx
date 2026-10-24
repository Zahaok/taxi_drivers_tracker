import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Percent, Clock, RotateCcw, Settings2, Save, CheckCircle2 } from 'lucide-react';
import { RateSettings, DEFAULT_SETTINGS, getSettings, saveSettings, resetSettings, subscribeSettings } from '../utils/settings';

// Настройки расчётов доступны только администратору.
// Изменения применяются ко всем отчётам мгновенно (единая точка правды — utils/settings.ts).

interface FieldDef {
  key: keyof RateSettings;
  title: string;
  hint: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  defaults: number;
}

const FIELDS: FieldDef[] = [
  { key: 'wheelySharePct', title: 'Доля водителя по Wheely', hint: 'Процент от чистого заработка Wheely, который получает водитель. Остаток удерживает сервис и автоматически переводит работодателю.', suffix: '%', min: 1, max: 99, step: 0.5, defaults: DEFAULT_SETTINGS.wheelySharePct },
  { key: 'yandexSharePct', title: 'Доля водителя по Яндекс', hint: 'Процент от общего дохода Яндекс («база» водителя). Остаток подлежит переводу руководителю.', suffix: '%', min: 1, max: 99, step: 0.5, defaults: DEFAULT_SETTINGS.yandexSharePct },
  { key: 'ownRentSharePct', title: 'Доля водителя по личной аренде', hint: 'Процент от общего дохода по собственной аренде. Остаток подлежит переводу руководителю.', suffix: '%', min: 1, max: 99, step: 0.5, defaults: DEFAULT_SETTINGS.ownRentSharePct },
  { key: 'hourlyRentRateRub', title: 'Стоимость часа почасовой аренды', hint: 'Сумма в рублях за один час почасовой аренды (по умолчанию 500 ₽). Можно увеличить, например, до 600 ₽.', suffix: '₽', min: 0, max: 1_000_000, step: 50, defaults: DEFAULT_SETTINGS.hourlyRentRateRub },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<RateSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  // Синхронизация, если настройки изменили в другой вкладке/сессии
  useEffect(() => subscribeSettings((s) => setForm(s)), []);

  if (user?.role !== 'admin') {
    return (
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-600">Настройки доступны только администратору</p>
      </div>
    );
  }

  const dirty = FIELDS.some((f) => Number(form[f.key]) !== Number(getSettings()[f.key]));

  const handleSave = () => {
    saveSettings({
      wheelySharePct: Number(form.wheelySharePct),
      yandexSharePct: Number(form.yandexSharePct),
      ownRentSharePct: Number(form.ownRentSharePct),
      hourlyRentRateRub: Number(form.hourlyRentRateRub),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    resetSettings();
    setForm(getSettings());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-amber-600" /> Настройки расчётов
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Проценты заработка и стоимость аренды применяются ко всем отчётам сразу после сохранения.
          </p>
        </div>
        <button onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-all text-sm">
          <RotateCcw className="w-4 h-4" /> Сбросить к значениям по умолчанию
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
        {FIELDS.map((f) => {
          const isPct = f.suffix === '%';
          const value = Number(form[f.key]);
          const changed = value !== f.defaults;
          return (
            <div key={f.key} className={`bg-white shadow-sm border rounded-xl p-5 transition-colors ${changed ? 'border-amber-300' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPct ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                  {isPct ? <Percent className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <h3 className="text-gray-900 font-semibold text-sm">{f.title}</h3>
              </div>
              <p className="text-gray-500 text-xs mb-3 leading-relaxed">{f.hint}</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={Number.isFinite(value) ? value : ''}
                  onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <span className="text-gray-500 text-sm shrink-0">{f.suffix}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-400">По умолчанию: {f.defaults}{f.suffix}</span>
                {changed && <span className="text-amber-600 font-medium">Изменено</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Живой предпросмотр эффекта настроек */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5">
        <h3 className="text-gray-900 font-semibold mb-3 text-sm">Как это применяется</h3>
        <ul className="space-y-2 text-sm text-gray-600 list-disc pl-5">
          <li><b className="text-gray-900">Wheely:</b> (общий − агентское − парковка − трезвый водитель) × {Number(form.wheelySharePct) || DEFAULT_SETTINGS.wheelySharePct}% + бонусы → к выплате</li>
          <li><b className="text-gray-900">Яндекс:</b> общий × {Number(form.yandexSharePct) || DEFAULT_SETTINGS.yandexSharePct}% − чаевые − ЗСД → заработок; {100 - (Number(form.yandexSharePct) || DEFAULT_SETTINGS.yandexSharePct)}% общего дохода — подлежит переводу</li>
          <li><b className="text-gray-900">Личная аренда:</b> общий × {Number(form.ownRentSharePct) || DEFAULT_SETTINGS.ownRentSharePct}% → водителю; {100 - (Number(form.ownRentSharePct) || DEFAULT_SETTINGS.ownRentSharePct)}% — подлежит переводу</li>
          <li><b className="text-gray-900">Почасовая аренда:</b> часы × {Number(form.hourlyRentRateRub)} ₽</li>
        </ul>
      </div>

      <div className="sticky bottom-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${
            dirty ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-300 cursor-not-allowed'
          }`}>
          <Save className="w-4 h-4" /> Сохранить настройки
        </button>
        {saved && (
          <span className="flex items-center gap-2 text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4" /> Настройки сохранены и применены ко всем отчётам
          </span>
        )}
        {dirty && !saved && <span className="text-gray-500 text-sm">Есть несохранённые изменения</span>}
      </div>
    </div>
  );
}
