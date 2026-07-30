# 印刷・書き出し

テンプレートは標準、コンパクト、2ページ分割、曲名特大、スタッフ進行表、会場提出用、演奏者用の7種類です。項目を個別にON／OFFでき、A4縦横、ブラウザー印刷、PDF、JPEGへ対応します。

exportライブラリは操作時にdynamic importします。共有ページでは共有リンクの`allow_print`、`allow_pdf`、`allow_jpeg`に従ってボタンを表示します。privateメモはPrintSheetへ渡しません。

Stage Viewは全画面、Wake Lock、前後曲、現在位置のsessionStorage保存、減光表示を持ちます。端末やブラウザーがWake Lockを提供しない場合は通常表示で継続します。
