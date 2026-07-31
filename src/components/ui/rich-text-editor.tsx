import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import {
  TextBoldIcon,
  TextItalicIcon,
  Heading01Icon,
  Heading02Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  LeftToRightBlockQuoteIcon,
  CodeIcon,
  Link01Icon,
  Unlink01Icon,
} from "hugeicons-react";

interface RichTextEditorProps {
  content: string; // markdown string in, markdown string out
  onChange: (markdown: string) => void;
  placeholder?: string;
}

// Minimal markdown → HTML for initial load
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupbcol])/gm, "");
}

// Serialize Tiptap JSON back to markdown
function serializeToMarkdown(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return "";
  const json = editor.getJSON();

  function nodeToMd(node: Record<string, unknown>): string {
    if (!node) return "";
    const children = (node.content as Record<string, unknown>[] | undefined) ?? [];

    if (node.type === "doc") return children.map(nodeToMd).join("\n\n").trim();

    if (node.type === "heading") {
      const level = (node.attrs as Record<string, unknown>)?.level as number ?? 1;
      const prefix = "#".repeat(level);
      return `${prefix} ${children.map(inlineToMd).join("")}`;
    }

    if (node.type === "paragraph") {
      const text = children.map(inlineToMd).join("");
      return text || "";
    }

    if (node.type === "bulletList") {
      return children.map((li) => {
        const content = ((li as Record<string, unknown>).content as Record<string, unknown>[] | undefined) ?? [];
        return `- ${content.map(nodeToMd).join("").trim()}`;
      }).join("\n");
    }

    if (node.type === "orderedList") {
      return children.map((li, i) => {
        const content = ((li as Record<string, unknown>).content as Record<string, unknown>[] | undefined) ?? [];
        return `${i + 1}. ${content.map(nodeToMd).join("").trim()}`;
      }).join("\n");
    }

    if (node.type === "listItem") return children.map(nodeToMd).join("").trim();

    if (node.type === "blockquote") {
      return children.map(nodeToMd).join("\n").split("\n").map(l => `> ${l}`).join("\n");
    }

    if (node.type === "codeBlock") {
      return `\`\`\`\n${children.map(inlineToMd).join("")}\n\`\`\``;
    }

    if (node.type === "horizontalRule") return "---";

    return children.map(nodeToMd).join("");
  }

  function inlineToMd(node: Record<string, unknown>): string {
    if (node.type === "hardBreak") return "\n";
    if (node.type !== "text") return nodeToMd(node);
    let text = (node.text as string) ?? "";
    const marks = (node.marks as Record<string, unknown>[] | undefined) ?? [];
    for (const mark of marks) {
      if (mark.type === "bold") text = `**${text}**`;
      else if (mark.type === "italic") text = `*${text}*`;
      else if (mark.type === "code") text = `\`${text}\``;
      else if (mark.type === "link") {
        const href = (mark.attrs as Record<string, string>)?.href ?? "";
        text = `[${text}](${href})`;
      }
    }
    return text;
  }

  return nodeToMd(json as Record<string, unknown>);
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const prevContent = React.useRef(content);
  const [linkInputOpen, setLinkInputOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const linkInputRef = React.useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "code-block" } } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      Typography,
      Link.configure({ openOnClick: false }),
    ],
    content: mdToHtml(content),
    onUpdate: ({ editor: e }) => {
      const md = serializeToMarkdown(e as unknown as ReturnType<typeof useEditor>);
      prevContent.current = md; // prevent the sync effect from re-setting editor content
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "rich-editor-content",
      },
    },
  });

  // Sync when the selected post changes externally (not from typing)
  React.useEffect(() => {
    if (editor && content !== prevContent.current) {
      prevContent.current = content;
      editor.commands.setContent(mdToHtml(content));
    }
  }, [content, editor]);

  function openLinkInput() {
    const existing = editor?.getAttributes("link").href as string | undefined;
    setLinkUrl(existing ?? "https://");
    setLinkInputOpen(true);
    setTimeout(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, 0);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (url && url !== "https://") {
      editor?.chain().focus().setLink({ href: url }).run();
    } else {
      editor?.chain().focus().unsetLink().run();
    }
    setLinkInputOpen(false);
    setLinkUrl("");
  }

  function cancelLink() {
    setLinkInputOpen(false);
    setLinkUrl("");
  }

  if (!editor) return null;

  return (
    <div className="rich-editor">
      {/* Toolbar */}
      <div className="rich-editor-toolbar">
        <ToolbarBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <Heading01Icon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading02Icon size={14} />
        </ToolbarBtn>

        <div className="rich-editor-divider" />

        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <TextBoldIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <TextItalicIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          <CodeIcon size={14} />
        </ToolbarBtn>

        <div className="rich-editor-divider" />

        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <LeftToRightListBulletIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <LeftToRightListNumberIcon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <LeftToRightBlockQuoteIcon size={14} />
        </ToolbarBtn>

        <div className="rich-editor-divider" />

        <ToolbarBtn
          active={editor.isActive("link") || linkInputOpen}
          onClick={openLinkInput}
          title="Add link"
        >
          <Link01Icon size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={false}
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remove link"
          disabled={!editor.isActive("link")}
        >
          <Unlink01Icon size={14} />
        </ToolbarBtn>
      </div>

      {/* Inline link input */}
      {linkInputOpen && (
        <div className="rich-editor-link-row">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") cancelLink();
            }}
            placeholder="https://"
            className="rich-editor-link-input"
          />
          <button type="button" onClick={applyLink} className="rich-editor-link-apply">Apply</button>
          <button type="button" onClick={cancelLink} className="rich-editor-link-cancel">Cancel</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  children, onClick, active, title, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={[
        "rich-editor-btn",
        active ? "rich-editor-btn-active" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
