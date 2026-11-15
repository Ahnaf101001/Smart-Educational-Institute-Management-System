"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { Bell, MessageSquare, FileEdit, Send, Save, Trash2 } from "lucide-react";
import { noticesApi } from "../lib/api";

const messageTypes = ["Notice", "SMS", "Email", "Both"];

function getTypeStyle(type) {
  if (type === "SMS") return "bg-purple-50 text-purple-600";
  if (type === "Email") return "bg-emerald-50 text-emerald-600";
  if (type === "Both") return "bg-indigo-50 text-indigo-600";
  return "bg-blue-50 text-blue-600";
}

function formatNoticeDate(notice) {
  const value = notice.sentAt || notice.createdAt;
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusStyle(status) {
  if (status === "Published" || status === "Sent") return "text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full";
  return "text-slate-500 bg-slate-100 px-3 py-1 rounded-full";
}

export default function NoticeSMS() {
  const [selectedType, setSelectedType] = useState("Notice");
  
  // Form State
  const [title, setTitle] = useState("");
  const [recipients, setRecipients] = useState("All Students");
  const [message, setMessage] = useState("");

  const [notices, setNotices] = useState([]);

  const fetchNotices = async () => {
    try {
      const data = await noticesApi.list();
      setNotices(data || []);
    } catch (error) {
      console.error("Failed to load notices:", error);
    }
  };

  useEffect(() => {
    noticesApi.list()
      .then((data) => setNotices(data || []))
      .catch((error) => console.error("Failed to load notices:", error));
  }, []);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", type: "info", action: null, confirmText: "Confirm" });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const promptSend = () => {
    if (!title || !message) {
      alert("Please enter a title and message.");
      return;
    }
    setModalConfig({
      isOpen: true,
      title: "Send Message",
      message: `Are you sure you want to send this ${selectedType} to ${recipients}?`,
      type: "info",
      confirmText: "Yes, Send It",
      action: handleSend
    });
  };

  const promptDelete = (id) => {
    setModalConfig({
      isOpen: true,
      title: "Delete Notice",
      message: "Are you sure you want to permanently delete this item? This action cannot be undone.",
      type: "danger",
      confirmText: "Yes, Delete",
      action: () => handleDelete(id)
    });
  };

  const saveNotice = async (targetStatus, shouldSend = false) => {
    if (!title || !message) {
      alert("Please enter a title and message.");
      return;
    }
    try {
      const notice = await noticesApi.create({
        title,
        message,
        channel: selectedType,
        audience: recipients,
        status: targetStatus || "Published",
      });

      if (shouldSend) {
        await noticesApi.send(notice.id);
      }

      await fetchNotices();
      setTitle("");
      setMessage("");
      closeModal();
    } catch (error) {
      console.error("Failed to save/send notice:", error);
      alert(error.message || "Failed to send notification.");
    }
  };

  const handleSend = () => {
    saveNotice(null, true);
  };

  const handleSaveDraft = () => {
    saveNotice("Draft");
  };

  const handleDelete = async (id) => {
    await noticesApi.remove(id);
    await fetchNotices();
    closeModal();
  };

  const totalNotices = notices.filter(n => n.channel === "Notice" || n.channel === "Both").length;
  const totalSMS = notices.filter(n => n.channel === "SMS" || n.channel === "Both").length;
  const draftCount = notices.filter(n => n.status === "Draft").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">Notice, SMS & Email</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col justify-center rounded-[24px] bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><FileEdit size={24} /></div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Notices</h3>
          </div>
          <p className="text-4xl font-black text-slate-800">{totalNotices}</p>
        </div>
        <div className="flex flex-col justify-center rounded-[24px] bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><MessageSquare size={24} /></div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">SMS Sent</h3>
          </div>
          <p className="text-4xl font-black text-slate-800">{totalSMS}</p>
        </div>
        <div className="flex flex-col justify-center rounded-[24px] bg-white p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><Save size={24} /></div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Drafts</h3>
          </div>
          <p className="text-4xl font-black text-slate-800">{draftCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Panel */}
        <div className="lg:col-span-1 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Send Notice / SMS / Email</h3>
          
          <div className="space-y-5 flex-1">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Type</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
                {messageTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`py-2 text-sm font-bold rounded-lg transition ${selectedType === type ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Title / Subject *</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter message title" 
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Recipients *</label>
                <select 
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition cursor-pointer"
                >
                  <option>All Students</option>
                  <option>All Teachers</option>
                  <option>All Staff</option>
                  <option>Parents (All)</option>
                  <option>Parents (Defaulters)</option>
                  <option>Specific Class</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Message *</label>
                <textarea 
                  rows="5" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..." 
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                ></textarea>
                <div className="text-right mt-1">
                  <span className="text-xs font-bold text-slate-400">160 chars / 1 SMS</span>
                </div>
              </div>

            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-100 mt-6">
              <button
                onClick={handleSaveDraft}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                Save Draft
              </button>
              <button 
                onClick={promptSend}
                className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
              >
                <Send size={16} /> Send {selectedType === "Both" ? "Message" : selectedType}
              </button>
            </div>
          </div>
        </div>

        {/* Table Panel */}
        <div className="lg:col-span-2 rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-slate-100 bg-white">
            <h3 className="text-lg font-bold text-slate-800">Recent Notices, SMS & Email</h3>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-white text-xs font-extrabold uppercase text-slate-500 border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Audience</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {notices.map((notice) => (
                  <tr key={notice.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-5 font-bold text-slate-800">
                      {notice.title}
                    </td>
                    <td className="px-6 py-5 font-medium text-slate-500">
                      {notice.audience}
                    </td>
                    <td className="px-6 py-5 font-medium text-slate-500 whitespace-nowrap">
                      {formatNoticeDate(notice)}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getTypeStyle(notice.channel)}`}>
                        {notice.channel}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`text-xs font-bold ${getStatusStyle(notice.status)}`}>
                        {notice.status}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <button 
                        onClick={() => promptDelete(notice.id)}
                        className="text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {notices.length === 0 && (
              <div className="py-12 text-center text-sm font-bold text-slate-400">
                No notices found
              </div>
            )}
          </div>
        </div>

      </div>

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.action}
        onCancel={closeModal}
      />
    </div>
  );
}
