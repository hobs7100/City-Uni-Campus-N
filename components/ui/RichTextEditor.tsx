"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontFamily, FontSize, Color } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Minus, Quote, RemoveFormatting,
  ChevronDown, Highlighter, Palette,
} from "lucide-react";

/* ─── constants ─────────────────────────────────────────────────────────── */
const FONT_FAMILIES = [
  { label: "Default",         value: "" },
  { label: "Arial",           value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Courier New",     value: "Courier New, monospace" },
  { label: "Georgia",         value: "Georgia, serif" },
  { label: "Verdana",         value: "Verdana, sans-serif" },
  { label: "Tahoma",          value: "Tahoma, sans-serif" },
  { label: "Trebuchet MS",    value: "Trebuchet MS, sans-serif" },
];

const FONT_SIZES = ["8","9","10","11","12","14","16","18","20","22","24","28","32","36","48","72"];

const COMMON_COLORS = [
  "#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#ffffff",
  "#ff0000","#ff4444","#ff9900","#ffff00","#00cc00","#00cccc","#4a86e8","#0000ff",
  "#9900ff","#ff00ff","#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6fa8dc",
  "#8e7cc3","#c27ba0",
];

/* ─── colour-picker popover ─────────────────────────────────────────────── */
function ColorPicker({
  label,
  icon: Icon,
  onSelect,
  onClear,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onSelect: (color: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="toolbar-btn flex items-center gap-0.5"
      >
        <Icon size={14} />
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-8 gap-1">
            {COMMON_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                style={{ backgroundColor: c }}
                className="h-5 w-5 rounded border border-slate-300 hover:scale-110 transition-transform"
                onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false); }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
            <input
              type="color"
              className="h-6 w-6 cursor-pointer rounded border-0 p-0"
              onChange={(e) => onSelect(e.target.value)}
            />
            <span className="text-xs text-slate-500">Custom</span>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onClear(); setOpen(false); }}
              className="ml-auto text-xs text-red-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── main editor ───────────────────────────────────────────────────────── */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your notification here…",
  minHeight = 220,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ strike: {}, underline: false }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    content: value || "",
    onUpdate({ editor: e }) {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: { class: "focus:outline-none" },
    },
  });

  /* reset when parent clears the form */
  const prevValue = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value === "" && prevValue.current !== "") {
      editor.commands.clearContent();
    }
    prevValue.current = value;
  }, [editor, value]);

  if (!editor) return null;

  const active = (name: string, attrs?: Record<string, unknown>) =>
    editor.isActive(name, attrs)
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
      : "";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">

      {/* ── toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800">

        {/* Font family */}
        <select
          title="Font Family"
          className="h-7 rounded border border-slate-200 bg-white px-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:outline-none"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontFamily(v).run();
            else   editor.chain().focus().unsetFontFamily().run();
            e.target.value = "";
          }}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          title="Font Size"
          className="h-7 w-14 rounded border border-slate-200 bg-white px-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 focus:outline-none"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) editor.chain().focus().setFontSize(v + "px").run();
            e.target.value = "";
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <Divider />

        {/* Bold / Italic / Underline / Strike */}
        <button type="button" title="Bold"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          className={`toolbar-btn ${active("bold")}`}><Bold size={14} /></button>

        <button type="button" title="Italic"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          className={`toolbar-btn ${active("italic")}`}><Italic size={14} /></button>

        <button type="button" title="Underline"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
          className={`toolbar-btn ${active("underline")}`}><UnderlineIcon size={14} /></button>

        <button type="button" title="Strikethrough"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
          className={`toolbar-btn ${active("strike")}`}><Strikethrough size={14} /></button>

        <Divider />

        {/* Text colour */}
        <ColorPicker
          label="Text Color"
          icon={Palette}
          onSelect={(c) => editor.chain().focus().setColor(c).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />

        {/* Highlight */}
        <ColorPicker
          label="Highlight Color"
          icon={Highlighter}
          onSelect={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
        />

        <Divider />

        {/* Alignment */}
        {(["left","center","right","justify"] as const).map((a, i) => {
          const icons = [AlignLeft, AlignCenter, AlignRight, AlignJustify];
          const Icon = icons[i];
          const isAlignActive = editor.isActive({ textAlign: a });
          return (
            <button key={a} type="button" title={`Align ${a}`}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign(a).run(); }}
              className={`toolbar-btn ${isAlignActive ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : ""}`}>
              <Icon size={14} />
            </button>
          );
        })}

        <Divider />

        {/* Lists */}
        <button type="button" title="Bullet List"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          className={`toolbar-btn ${active("bulletList")}`}><List size={14} /></button>

        <button type="button" title="Numbered List"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
          className={`toolbar-btn ${active("orderedList")}`}><ListOrdered size={14} /></button>

        <button type="button" title="Blockquote"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }}
          className={`toolbar-btn ${active("blockquote")}`}><Quote size={14} /></button>

        <button type="button" title="Horizontal Rule"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }}
          className="toolbar-btn"><Minus size={14} /></button>

        <Divider />

        {/* Clear formatting */}
        <button type="button" title="Clear Formatting"
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().clearNodes().unsetAllMarks().run(); }}
          className="toolbar-btn"><RemoveFormatting size={14} /></button>
      </div>

      {/* ── content area ───────────────────────────────────────────────────── */}
      <div
        className="rich-editor-content relative px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
        style={{ minHeight }}
        onClick={() => editor.commands.focus()}
      >
        {editor.isEmpty && (
          <p className="pointer-events-none absolute top-3 text-slate-400 select-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-600" />;
}
