import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { BrandMark } from './BrandMark';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[SETPRINT] 画面の描画に失敗しました', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error">
        <BrandMark />
        <span><AlertTriangle /></span>
        <p className="eyebrow">表示エラー</p>
        <h1>この画面を表示できませんでした</h1>
        <p>入力内容は消さずに、画面を再読み込みしてください。同じ状態が続く場合は、直前の操作を控えて管理者へお知らせください。</p>
        <button className="primary" onClick={() => window.location.reload()}>
          <RefreshCw />再読み込み
        </button>
      </main>
    );
  }
}
