import { useRef, useState } from 'react';
import {
  Check, Download, FileImage, Maximize2, Printer, RotateCw,
} from 'lucide-react';
import { EmptyState, PageHead } from '../../components/PageElements';
import { exportElementAsJpeg, exportElementAsPdf } from '../../services/exportService';
import { formatDuration } from '../../utils/time';
import { CUE_LABELS, effectiveVersion, liveTiming, sortedEntries } from '../setlists/setlistModel';

const TEMPLATES = {
  standard: ['標準セットリスト', '曲情報とキューをバランスよく表示'],
  compact: ['コンパクト', '曲数が多いライブ向け'],
  split: ['2ページ分割', '折り目をまたがない余白'],
  large: ['曲名特大', '暗い舞台袖でも読みやすい'],
  staff: ['スタッフ進行表', 'MC・SE・転換と操作担当を重視'],
  venue: ['会場提出用', '提出情報を簡潔に整理'],
  performer: ['演奏者用', 'Key・BPM・同期・開始方法を重視'],
};

const FIELD_LABELS = {
  number: '曲番号', title: '曲名', version: 'バージョン', key: 'Key',
  bpm: 'BPM', duration: '尺', start: '開始', end: '終了', sync: '同期',
  click: 'Click', cues: 'MC・SE・転換', publicNote: '公開メモ',
  roleNote: '演奏者メモ', staffNote: 'スタッフメモ', time: '時刻',
};

const DEFAULT_FIELDS = Object.fromEntries(Object.keys(FIELD_LABELS).map((field) => [field, true]));

function buildPrintRows(entries, cues, versions) {
  return entries.reduce((result, entry) => {
    const version = effectiveVersion(entry, versions);
    const entryCues = cues.filter((cue) => cue.afterEntryId === entry.id);
    const cueSeconds = entryCues.reduce((total, cue) => total + Number(cue.durationSec || 0), 0);
    return {
      elapsed: result.elapsed + Number(version.durationSec || 0) + cueSeconds,
      rows: [...result.rows, {
        entry,
        entryCues,
        offset: result.elapsed,
        version,
      }],
    };
  }, { elapsed: 0, rows: [] }).rows;
}

export default function PrintStudioPage({ data, live, navigate }) {
  const [template, setTemplate] = useState('standard');
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [landscape, setLandscape] = useState(false);
  const [exporting, setExporting] = useState('');
  const paperRef = useRef(null);
  if (!live) return <div className="page"><EmptyState title="印刷するセットリストがありません" text="先にセットリストを作成してください。" /></div>;
  const filename = `SETPRINT-${live.date || 'undated'}-${live.title}`.replace(/[\\/:*?"<>|]/g, '-');

  const runExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'pdf') await exportElementAsPdf(paperRef.current, filename, { landscape });
      else await exportElementAsJpeg(paperRef.current, filename, { pixelRatio: 2 });
    } catch (error) {
      console.error('[SETPRINT export]', error);
      window.alert('書き出しに失敗しました。ブラウザー印刷をお試しください。');
    } finally { setExporting(''); }
  };

  return (
    <div className="page print-studio-page">
      <PageHead eyebrow="印刷・書き出し" title="現場で読む一枚に整える" text="紙は白、Stage Viewは黒。用途を混ぜず、必要な情報だけを選びます。">
        <button className="secondary" onClick={() => navigate(`/stage/${live.id}`)}><Maximize2 />Stage View</button>
        <button className="primary" onClick={() => window.print()}><Printer />ブラウザー印刷</button>
      </PageHead>
      <section className="print-console">
        <div className="template-picker"><span className="eyebrow">テンプレート</span>{Object.entries(TEMPLATES).map(([value, [label, text]]) => <button className={template === value ? 'active' : ''} onClick={() => setTemplate(value)} key={value}><b>{label}</b><small>{text}</small>{template === value && <Check />}</button>)}</div>
        <div className="print-settings"><span className="eyebrow">表示項目</span><div>{Object.entries(FIELD_LABELS).map(([field, label]) => <label key={field}><input type="checkbox" checked={fields[field]} onChange={(event) => setFields({ ...fields, [field]: event.target.checked })} />{label}</label>)}</div><label className="orientation-toggle"><input type="checkbox" checked={landscape} onChange={(event) => setLandscape(event.target.checked)} /><RotateCw />A4横向き</label><div className="export-buttons"><button className="secondary" disabled={Boolean(exporting)} onClick={() => runExport('pdf')}><Download />{exporting === 'pdf' ? 'PDF作成中…' : 'PDF保存'}</button><button className="secondary" disabled={Boolean(exporting)} onClick={() => runExport('jpeg')}><FileImage />{exporting === 'jpeg' ? 'JPEG作成中…' : 'JPEG保存'}</button></div></div>
      </section>
      <PrintSheet ref={paperRef} data={data} live={live} template={template} fields={fields} landscape={landscape} />
    </div>
  );
}

export function PrintSheet({ ref, data, live, template = 'standard', fields = DEFAULT_FIELDS, landscape = false }) {
  const entries = sortedEntries(data, live.id);
  const cues = data.setlistCues.filter((cue) => cue.liveId === live.id);
  const timing = liveTiming(data, live);
  const start = live.date ? new Date(`${live.date}T00:00`) : null;
  const rows = buildPrintRows(entries, cues, data.songVersions);
  return (
    <article ref={ref} className={`print-sheet template-${template} ${landscape ? 'landscape' : ''}`}>
      <header><div><small>SETPRINT / {TEMPLATES[template]?.[0]}</small><h1>{live.title}</h1><p>{live.date || '日付未定'} / {live.venue || '会場未定'}</p></div><dl><div><dt>持ち時間</dt><dd>{formatDuration(live.timeLimitSec)}</dd></div><div><dt>合計</dt><dd>{formatDuration(timing.totalSeconds)}</dd></div><div><dt>曲数</dt><dd>{entries.length}</dd></div></dl></header>
      <section className="print-list">{rows.map((row, index) => (
        <div key={row.entry.id} className="print-entry-group">
          <article className="print-entry">
            {fields.number && <b className="print-number">{String(index + 1).padStart(2, '0')}</b>}
            <div>
              <small>{fields.version ? row.entry.versionNameSnapshot : ''}</small>
              <h2>{row.entry.titleSnapshot}</h2>
              <p>
                {fields.key && `Key ${row.version.key || '—'}`}
                {fields.bpm && ` / BPM ${row.version.bpm || '—'}`}
                {fields.start && ` / 開始 ${row.version.startType || row.version.defaultStartType || '—'}`}
                {fields.end && ` / 終了 ${row.version.endType || '—'}`}
              </p>
              {fields.publicNote && row.entry.publicNote && <em>{row.entry.publicNote}</em>}
              {fields.roleNote && template === 'performer' && row.entry.roleNote && <em>演奏者：{row.entry.roleNote}</em>}
              {fields.staffNote && template === 'staff' && row.entry.staffNote && <em>スタッフ：{row.entry.staffNote}</em>}
            </div>
            <div className="print-flags">
              {fields.sync && row.version.hasSync && <span>同期</span>}
              {fields.click && row.version.hasClick && <span>Click</span>}
              {fields.duration && <time>{formatDuration(row.version.durationSec)}</time>}
              {fields.time && start && <small>+{formatDuration(row.offset)}</small>}
            </div>
          </article>
          {fields.cues && row.entryCues.map((cue) => (
            <div className="print-cue" key={cue.id}>
              <span>↓ {CUE_LABELS[cue.type] || cue.type}</span>
              <b>{[
                cue.cueType,
                cue.triggerPerson && `${cue.triggerPerson}合図`,
                cue.operator && `${cue.operator}操作`,
                cue.playback,
              ].filter(Boolean).join(' / ')}</b>
              <time>{formatDuration(cue.durationSec)}</time>
            </div>
          ))}
        </div>
      ))}</section>
      <footer><span>SETPRINT</span><small>作成日時 {new Date().toLocaleString('ja-JP')} / 個人メモは含まれていません</small></footer>
    </article>
  );
}
