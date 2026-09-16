"use client";

import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, Extension, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyError } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

const EMAIL_FONTS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: '"Courier New", Courier, monospace' },
] as const;

const EMAIL_FONT_SIZES = [
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
] as const;

const MAX_EMAIL_IMAGE_BYTES = 350 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

export function EmailHtmlEditor({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    content: value || "",
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        heading: { levels: [1, 2] },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          style: "max-width: 100%; height: auto;",
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({
        placeholder: "Escribe el cuerpo del mensaje…",
      }),
    ],
    editorProps: {
      attributes: {
        class: "email-html-editor-content min-h-[220px] outline-none",
        ...(id ? { id } : {}),
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((file) =>
          ALLOWED_IMAGE_TYPES.has(file.type),
        );
        if (!images.length) return false;
        void insertImageFiles(editorRef.current, images);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const images = files.filter((file) =>
          ALLOWED_IMAGE_TYPES.has(file.type),
        );
        if (!images.length) return false;
        event.preventDefault();
        void insertImageFiles(editorRef.current, images);
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card",
        disabled && "opacity-60",
      )}
    >
      <Toolbar
        editor={editor}
        disabled={disabled || !editor}
        onInsertImage={() => imageInputRef.current?.click()}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void insertImageFiles(editor, files);
        }}
      />
      <div className="bg-white px-3 py-2 text-black">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  disabled,
  onInsertImage,
}: {
  editor: Editor | null;
  disabled?: boolean;
  onInsertImage: () => void;
}) {
  const fontFamily =
    (editor?.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const fontSize =
    (editor?.getAttributes("textStyle").fontSize as string | undefined) ?? "";
  const color =
    (editor?.getAttributes("textStyle").color as string | undefined) ||
    "#000000";
  const heading = editor?.isActive("heading", { level: 1 })
    ? "h1"
    : editor?.isActive("heading", { level: 2 })
      ? "h2"
      : "p";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2">
      <select
        aria-label="Estilo de párrafo"
        className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        disabled={disabled}
        value={heading}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "h1") {
            editor?.chain().focus().toggleHeading({ level: 1 }).run();
            return;
          }
          if (next === "h2") {
            editor?.chain().focus().toggleHeading({ level: 2 }).run();
            return;
          }
          editor?.chain().focus().setParagraph().run();
        }}
      >
        <option value="p">Párrafo</option>
        <option value="h1">Título</option>
        <option value="h2">Subtítulo</option>
      </select>
      <select
        aria-label="Fuente"
        className="h-8 max-w-[9.5rem] rounded-md border border-border bg-card px-2 text-xs"
        disabled={disabled}
        value={EMAIL_FONTS.some((font) => font.value === fontFamily) ? fontFamily : ""}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            editor?.chain().focus().unsetFontFamily().run();
            return;
          }
          editor?.chain().focus().setFontFamily(next).run();
        }}
      >
        <option value="">Fuente</option>
        {EMAIL_FONTS.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Tamaño de fuente"
        className="h-8 rounded-md border border-border bg-card px-2 text-xs"
        disabled={disabled}
        value={EMAIL_FONT_SIZES.includes(fontSize as (typeof EMAIL_FONT_SIZES)[number]) ? fontSize : ""}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            editor
              ?.chain()
              .focus()
              .setMark("textStyle", { fontSize: null })
              .removeEmptyTextStyle()
              .run();
            return;
          }
          editor?.chain().focus().setMark("textStyle", { fontSize: next }).run();
        }}
      >
        <option value="">Tamaño</option>
        {EMAIL_FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>
      <ToolbarButton
        label="Negrita"
        active={editor?.isActive("bold")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Cursiva"
        active={editor?.isActive("italic")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subrayado"
        active={editor?.isActive("underline")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <label className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs">
        Color
        <input
          aria-label="Color de texto"
          type="color"
          className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          disabled={disabled}
          value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000"}
          onChange={(event) => {
            editor?.chain().focus().setColor(event.target.value).run();
          }}
        />
      </label>
      <ToolbarButton
        label="Alinear a la izquierda"
        active={editor?.isActive({ textAlign: "left" })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Centrar"
        active={editor?.isActive({ textAlign: "center" })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().setTextAlign("center").run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Alinear a la derecha"
        active={editor?.isActive({ textAlign: "right" })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().setTextAlign("right").run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Viñetas"
        active={editor?.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numeración"
        active={editor?.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insertar enlace"
        active={editor?.isActive("link")}
        disabled={disabled}
        onClick={() => {
          const previous = editor?.getAttributes("link").href as
            | string
            | undefined;
          const url = window.prompt("URL del enlace", previous || "https://");
          if (url === null) return;
          if (!url.trim()) {
            editor?.chain().focus().unsetLink().run();
            return;
          }
          editor?.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Insertar logo o imagen"
        disabled={disabled}
        onClick={onInsertImage}
      >
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Deshacer"
        disabled={disabled || !editor?.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Rehacer"
        disabled={disabled || !editor?.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={active ? "secondary" : "ghost"}
          className="h-8 w-8 p-0"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

async function insertImageFiles(editor: Editor | null, files: File[]) {
  if (!editor || !files.length) return;
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      notifyError(
        new Error("Usa PNG, JPG, GIF o WEBP."),
        "Usa PNG, JPG, GIF o WEBP.",
      );
      continue;
    }
    if (file.size > MAX_EMAIL_IMAGE_BYTES) {
      notifyError(
        new Error("La imagen supera 350 KB."),
        "La imagen supera 350 KB. Reduce el logo e inténtalo de nuevo.",
      );
      continue;
    }
    const src = await readFileAsDataUrl(file);
    editor.chain().focus().setImage({ src, alt: file.name }).run();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("No se pudo leer la imagen."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}
