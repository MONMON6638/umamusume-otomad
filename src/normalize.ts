// 検索とキャラ判定で使う表記ゆれの吸収。全角半角・大小文字・ひらがなカタカナをそろえる
export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}
