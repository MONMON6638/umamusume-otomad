import { matchOptions, type Option } from "./filter.ts";

// 一度に描く候補の数。それより多いときは文字を入れて絞ってもらう
const MAX_ITEMS = 50;

export type Combo = { setValue: (name: string) => void };

// キャラ・投稿者の絞り込み欄。押すとすぐ候補が開き、選んでいても全部の候補から選び直せる。
// HTML は <div class="combo"><input><button class="combo-clear"><ul class="combo-list"></div> の形
export function createCombo(input: HTMLInputElement, options: Option[], onSelect: (name: string) => void): Combo {
  const root = input.parentElement as HTMLElement;
  const list = root.querySelector(".combo-list") as HTMLUListElement;
  const clear = root.querySelector(".combo-clear") as HTMLButtonElement;
  const names = new Set(options.map((o) => o.name));
  let selected = "";
  let shown: Option[] = [];
  let active = -1;

  function setValue(name: string) {
    selected = name;
    input.value = name;
    clear.hidden = !name;
  }

  function choose(name: string) {
    setValue(name);
    close();
    // 欄から離れておくと、次に押したときにまた全部の候補から選べる（スマホではキーボードも閉じる）
    input.blur();
    onSelect(name);
  }

  function renderList(query: string) {
    shown = matchOptions(options, query);
    active = -1;
    const items = shown.slice(0, MAX_ITEMS).map((o, i) => {
      const li = document.createElement("li");
      li.className = "combo-item";
      li.id = `${list.id}-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(o.name === selected));
      const name = document.createElement("span");
      name.className = "combo-name";
      name.textContent = o.name;
      const count = document.createElement("span");
      count.className = "combo-count";
      count.textContent = String(o.count);
      li.append(name, count);
      // blur より先に選ばせる
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(o.name);
      });
      return li;
    });
    if (shown.length === 0) items.push(note("見つかりませんでした"));
    else if (shown.length > MAX_ITEMS) items.push(note(`ほか ${shown.length - MAX_ITEMS} 件。文字を入れて絞り込めます`));
    list.replaceChildren(...items);
  }

  function note(text: string) {
    const li = document.createElement("li");
    li.className = "combo-note";
    li.textContent = text;
    return li;
  }

  function open() {
    renderList(input.value);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function move(delta: number) {
    const count = Math.min(shown.length, MAX_ITEMS);
    if (count === 0) return;
    active = (active + delta + count) % count;
    const items = list.querySelectorAll<HTMLElement>(".combo-item");
    items.forEach((el, i) => el.classList.toggle("is-active", i === active));
    items[active].scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", items[active].id);
  }

  // 押したら欄を空にして、選んでいる名前は薄い字で見せる。すぐ打ち始められ、候補も全部出る
  const placeholder = input.placeholder;
  function begin() {
    if (selected) {
      input.value = "";
      input.placeholder = selected;
    }
    open();
  }
  input.addEventListener("focus", begin);
  input.addEventListener("click", () => {
    if (list.hidden) begin();
  });
  input.addEventListener("input", () => {
    renderList(input.value);
    list.hidden = false;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter") {
      const exact = input.value.trim();
      if (active >= 0) choose(shown[active].name);
      else if (names.has(exact)) choose(exact);
      else if (shown.length > 0 && exact) choose(shown[0].name);
      else return;
    } else if (e.key === "Escape") {
      input.blur();
    } else return;
    e.preventDefault();
  });
  // 選ばずに離れたら元に戻す。解除は ✕ で行う
  input.addEventListener("blur", () => {
    close();
    input.placeholder = placeholder;
    input.value = selected;
  });
  clear.addEventListener("click", () => choose(""));

  return { setValue };
}
