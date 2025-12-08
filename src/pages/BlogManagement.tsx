// src/frontend/pages/BlogManagement.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Trash2, Plus, X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../services/api';
import ReactQuill from 'react-quill-new';
import 'quill/dist/quill.snow.css';

type Blog = {
  id: number;
  title: string;
  content: string;
  author_id: number;
  create_at?: string;
  update_at?: string;
  cover_image_url?: string | null;
  author_name?: string;
};

type Me = { user_id: number; name?: string; email?: string };

export default function BlogManagement() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Blog | null>(null);
  const [title, setTitle] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [content, setContent] = useState('');

  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);

  const quillRef = useRef<ReactQuill | null>(null);

  const loadMe = async () => {
    try {
      const res = await api.get('/admin/me');
      const _me: Me = res.data?.data || res.data;
      setMe(_me ?? null);
    } catch {
      setMe(null);
    }
  };

  const loadBlogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/blogs');
      const list: Blog[] = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setBlogs(list);
    } catch (err) {
      console.error('load blogs error:', err);
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadMe(), loadBlogs()]);
    })();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setCover(null);
    setContent('');
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (b: Blog) => {
    setEditing(b);
    setTitle(b.title);
    setCover(null);
    setContent(b.content || '');
    setOpen(true);
  };
  const closeModal = () => { setOpen(false); resetForm(); };

  // upload image (inline) สำหรับ ReactQuill
  const uploadInlineImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/admin/blogs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.url as string;
  };

  // Toolbar + handler
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'image', 'clean'],
      ],
      handlers: {
        image: function (this: any) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async () => {
            const file = (input.files && input.files[0]) || null;
            if (!file) return;
            try {
              const url = await uploadInlineImage(file);
              const editor = quillRef.current?.getEditor();
              const range = editor?.getSelection(true);
              if (editor && range) editor.insertEmbed(range.index, 'image', url, 'user');
            } catch (e) { console.error('inline upload error:', e); }
          };
          input.click();
        },
      },
    },
  }), []);

  const htmlIsEmpty = (html: string) => {
    const text = html.replace(/<[^>]+>/g, '').trim();
    return text.length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('กรุณากรอกชื่อเรื่อง');
    if (htmlIsEmpty(content)) return alert('กรุณาใส่เนื้อหา');
    if (!me?.user_id) return alert('ไม่พบผู้ใช้ที่ล็อกอินอยู่ (author) — โปรดล็อกอินใหม่');

    try {
      setSaving(true);
      const form = new FormData();
      form.append('title', title);
      form.append('content', content);
      // ✅ ใช้ author_id = admin ที่ล็อกอินอยู่เสมอ
      form.append('author_id', String(me.user_id));
      if (cover) form.append('cover', cover);

      if (editing) {
        // NOTE: อัปเดตก็ผูก author ให้เป็นแอดมินที่แก้ไข ณ ตอนนี้ตาม requirement
        await api.put(`/admin/blogs/${editing.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/admin/blogs', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      await loadBlogs();
      closeModal();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'เกิดข้อผิดพลาดระหว่างบันทึก';
      console.error('save blog error:', err);
      alert(`บันทึกไม่สำเร็จ: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ลบบทความนี้หรือไม่?')) return;
    try {
      await api.delete(`/admin/blogs/${id}`);
      await loadBlogs();
    } catch (err) {
      console.error('delete blog error:', err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Blog Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {me?.user_id ? `Logged in as ${me.name || me.email || '#' + me.user_id} (id: ${me.user_id})` : 'Not logged in'}
          </span>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
            <Plus size={20} />
            <span>New Blog</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-auto">
        {loading ? (
          <div className="p-4">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">ID</th>
                <th className="p-2">Cover</th>
                <th className="p-2">Title</th>
                <th className="p-2">Author</th>
                <th className="p-2">Created</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.id}</td>
                  <td className="p-2">
                    {b.cover_image_url ? (
                      <img src={b.cover_image_url} className="w-20 h-14 object-cover rounded" />
                    ) : ('-')}
                  </td>
                  <td className="p-2">{b.title}</td>
                  <td className="p-2">{b.author_name || `#${b.author_id}`}</td>
                  <td className="p-2">{b.create_at ? new Date(b.create_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2">{b.update_at ? new Date(b.update_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                        onClick={() => openEdit(b)}
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        onClick={() => handleDelete(b.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {blogs.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">No blogs</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b bg-gray-50/50 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">{editing ? 'Edit Blog' : 'Create New Blog'}</h3>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 150))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder="Enter blog title..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Author</label>
                  <input
                    value={
                      me?.user_id
                        ? `${me?.name || me?.email || ''} (id: ${me.user_id})`
                        : 'Not logged in'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                    disabled
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Cover Image</label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="flex-1 w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 hover:border-blue-500 transition-colors group relative overflow-hidden">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10">
                        <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <p className="text-sm text-gray-500 group-hover:text-gray-700">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400">SVG, PNG, JPG or GIF</p>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setCover(e.target.files?.[0] || null)} />
                    </label>
                    {cover && <p className="mt-2 text-sm text-green-600 flex items-center gap-1"><ImageIcon size={14} /> Selected: {cover.name}</p>}
                  </div>

                  {(editing?.cover_image_url || cover) && (
                    <div className="shrink-0">
                      <p className="text-xs text-gray-500 mb-2">Preview</p>
                      <div className="w-48 h-32 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 relative shadow-sm">
                        {cover ? (
                          <img src={URL.createObjectURL(cover)} className="w-full h-full object-cover" alt="Preview" />
                        ) : editing?.cover_image_url ? (
                          <img src={editing.cover_image_url} className="w-full h-full object-cover" alt="Current cover" />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <div className="prose-editor-wrapper border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <ReactQuill
                    ref={quillRef as any}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    className="h-[300px] mb-10"
                  />
                </div>
              </div>
            </form>

            <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={saving}
              >
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Blog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
