import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

import ReactQuill from 'react-quill-new';
import 'quill/dist/quill.snow.css';

type Blog = {
  id: number;
  title: string;
  content: string;             // เก็บเป็น HTML (LONGTEXT)
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
  const [authorId, setAuthorId] = useState<number | ''>('');     // 👈 กลับมาแล้ว
  const [cover, setCover] = useState<File | null>(null);
  const [content, setContent] = useState('');

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const quillRef = useRef<ReactQuill | null>(null);

  const loadMe = async () => {
    try {
      const res = await api.get('/auth/me');
      const me: Me = res.data?.data || res.data;
      setCurrentUserId(me?.user_id ?? null);
      // ตั้งค่า default author ให้เป็นคนที่ login
      setAuthorId(me?.user_id ?? '');
    } catch (e) {
      console.error('load me error:', e);
      setCurrentUserId(null);
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
    setAuthorId(currentUserId ?? ''); // default เป็นคนที่ล็อกอิน
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (b: Blog) => {
    setEditing(b);
    setTitle(b.title);
    setCover(null);
    setContent(b.content || '');
    setAuthorId(b.author_id); // ตั้งเป็นของบทความนั้น ๆ
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    resetForm();
  };

  // upload image (inline) สำหรับ ReactQuill
  const uploadInlineImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/admin/blogs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.url as string;
  };

  // ตั้ง toolbar + image handler
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
          input.setAttribute('type', 'file');
          input.setAttribute('accept', 'image/*');
          input.onchange = async () => {
            const file = (input.files && input.files[0]) || null;
            if (!file) return;
            try {
              const url = await uploadInlineImage(file);
              const editor = quillRef.current?.getEditor();
              const range = editor?.getSelection(true);
              if (editor && range) {
                editor.insertEmbed(range.index, 'image', url, 'user');
              }
            } catch (e) {
              console.error('inline upload error:', e);
            }
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

  // ส่ง author_id ไปด้วยตามที่เลือก
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('กรุณากรอกชื่อเรื่อง');
      return;
    }
    if (htmlIsEmpty(content)) {
      alert('กรุณาใส่เนื้อหา');
      return;
    }
    if (authorId === '' || !Number.isFinite(Number(authorId))) {
      alert('กรุณาระบุ Author ID ให้ถูกต้อง');
      return;
    }

    try {
      setSaving(true);
      const form = new FormData();
      form.append('title', title);
      form.append('content', content);
      form.append('author_id', String(authorId));
      if (cover) form.append('cover', cover);

      if (editing) {
        await api.put(`/admin/blogs/${editing.id}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/admin/blogs', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await loadBlogs();
      closeModal();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'เกิดข้อผิดพลาดระหว่างบันทึก';
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
            {currentUserId ? `Logged in as #${currentUserId}` : 'Not logged in'}
          </span>
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded">
            New Blog
          </button>
        </div>
      </div>

      {/* ตารางแสดงรายการ */}
      <div className="bg-white rounded shadow overflow-auto">
        {loading ? (
          <div className="p-4">Loading...</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2">ID</th>
                <th className="p-2">Title</th>
                <th className="p-2">Author</th>
                <th className="p-2">Created</th>
                <th className="p-2">Updated</th>
                <th className="p-2">Cover</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.id}</td>
                  <td className="p-2">{b.title}</td>
                  <td className="p-2">{b.author_name || b.author_id}</td>
                  <td className="p-2">{b.create_at ? new Date(b.create_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2">{b.update_at ? new Date(b.update_at).toLocaleDateString() : '-'}</td>
                  <td className="p-2">
                    {b.cover_image_url ? (
                      <img src={b.cover_image_url} className="w-14 h-10 object-cover rounded" />
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-2 space-x-2">
                    <button className="px-2 py-1 bg-blue-100 rounded" onClick={() => openEdit(b)}>
                      Edit
                    </button>
                    <button className="px-2 py-1 bg-red-100 rounded" onClick={() => handleDelete(b.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {blogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">No blogs</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal สร้าง/แก้ไข */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? 'แก้ไขบทความ' : 'สร้างบทความใหม่'}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm">Title</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 20))}
                    className="w-full border px-3 py-2 rounded"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm">Author ID</label>
                  <input
                    type="number"
                    value={authorId}
                    onChange={(e) => setAuthorId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border px-3 py-2 rounded"
                    required
                    min={1}
                    placeholder="ใส่หมายเลขผู้เขียน"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm">Cover image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCover(e.target.files?.[0] || null)}
                />
                {editing?.cover_image_url && !cover && (
                  <div className="mt-2">
                    <img src={editing.cover_image_url} className="w-32 h-20 object-cover rounded" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1">Content</label>
                <ReactQuill
                  ref={quillRef as any}
                  theme="snow"
                  value={content}
                  onChange={setContent}
                  modules={modules}
                  style={{ height: 300, marginBottom: 40 }}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 rounded border">
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'สร้างบทความ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
