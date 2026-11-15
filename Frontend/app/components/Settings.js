"use client";

import { useState, useRef, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import { Building2, GraduationCap, Users, Settings as SettingsIcon, Upload, Check, Plus, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { academicApi, usersApi, rolesApi, instituteProfileApi } from "../lib/api";

const parseBreakAfterPeriods = (value) => {
  if (Array.isArray(value)) return value.map(Number).filter((item) => Number.isInteger(item) && item > 0);
  return String(value || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const isProtectedAdminUser = (user) => {
  const role = String(user?.role || "").toLowerCase();
  const email = String(user?.email || "").toLowerCase();
  return role === "admin" || role === "super admin" || email === "admin@school.edu";
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Institute Profile");
  const [logoUrl, setLogoUrl] = useState(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Teacher", password: "", currentPassword: "" });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingRoleIndex, setEditingRoleIndex] = useState(null);

  const [instituteProfile, setInstituteProfile] = useState({
    name: "EduManage School & College",
    type: "School + College + Madrasa",
    eiin: "123456",
    phone: "01XX-XXXXXXXX",
    email: "info@school.edu",
    website: "www.school.edu",
    establishedYear: "1995",
    capacity: "3000",
    address: "123 Education Road, Dhaka, Bangladesh",
    logoUrl: ""
  });

  const [systemSettings, setSystemSettings] = useState({
    emailNotif: true,
    smsNotif: true,
    systemAlerts: true,
    newsletter: false,
    autoBackup: "Daily at 2:00 AM",
    backupRetention: "30 days",
    sessionTimeout: "30 minutes",
    twoFactorAuth: "Enabled for Admins"
  });

  const [usersList, setUsersList] = useState([]);
  const [rolesList, setRolesList] = useState([]);

  const [academicSettings, setAcademicSettings] = useState({
    gradingSystem: "GPA (0-5)",
    workingDays: 6,
    startTime: "08:00 AM",
    periodDuration: 45,
    periodsPerDay: 8,
    breakAfterPeriods: [3, 6],
    breakDurationMinutes: 15
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [acaData, instData, uData, rData] = await Promise.all([
          academicApi.load(),
          instituteProfileApi.get(),
          usersApi.list(),
          rolesApi.list()
        ]);
        
        if (acaData && acaData.settings) {
          setAcademicSettings({
            gradingSystem: acaData.settings.gradingSystem || "GPA (0-5)",
            workingDays: acaData.settings.workingDays || 6,
            startTime: acaData.settings.startTime || "08:00 AM",
            periodDuration: acaData.settings.periodDuration || 45,
            periodsPerDay: acaData.settings.periodsPerDay || 8,
            breakAfterPeriods: parseBreakAfterPeriods(acaData.settings.breakAfterPeriods || [3, 6]),
            breakDurationMinutes: acaData.settings.breakDurationMinutes || 15
          });
        }
        
        if (instData) setInstituteProfile(instData);
        if (uData) setUsersList((uData || []).filter(Boolean));
        if (rData) setRolesList((rData || []).filter(Boolean));

      } catch (err) {
        console.error("Failed to load settings", err);
      }
    }
    loadData();
  }, []);

  const fileInputRef = useRef(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", type: "info", action: null, confirmText: "Confirm" });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2 MB");
        return;
      }
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  const tabs = [
    { name: "Institute Profile", icon: <Building2 size={18} /> },
    { name: "Academic Settings", icon: <GraduationCap size={18} /> },
    { name: "User Management", icon: <Users size={18} /> },
    { name: "System Settings", icon: <SettingsIcon size={18} /> },
  ];


  const resetUserForm = () => {
    setNewUser({ name: "", email: "", role: "Teacher", password: "", currentPassword: "" });
    setEditingUserId(null);
    setShowPassword(false);
    setShowCurrentPassword(false);
  };

  const handleStartEditUser = (user) => {
    setEditingUserId(user.id);
    setNewUser({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "Teacher",
      password: "",
      currentPassword: user.plainPassword || "",
    });
    setShowAddUserForm(true);
  };

  const promptCreateUser = () => {
    if (!newUser.name || !newUser.email || (!editingUserId && !newUser.password)) {
      alert("Please fill in all required fields.");
      return;
    }
    setModalConfig({
      isOpen: true,
      title: editingUserId ? "Update User" : "Create User",
      message: editingUserId
        ? `Are you sure you want to update ${newUser.name}?`
        : `Are you sure you want to create a new ${newUser.role} account for ${newUser.name}?`,
      type: "info",
      confirmText: editingUserId ? "Yes, Update User" : "Yes, Create User",
      action: handleCreateUser
    });
  };

  const promptDeleteUser = (user) => {
    if (isProtectedAdminUser(user)) {
      alert("Admin user cannot be deleted.");
      return;
    }

    setModalConfig({
      isOpen: true,
      title: "Delete User",
      message: "Are you sure you want to permanently delete this user? This action cannot be undone.",
      type: "danger",
      confirmText: "Yes, Delete",
      action: () => handleDeleteUser(user.id)
    });
  };

  const promptSaveSettings = (moduleName) => {
    setModalConfig({
      isOpen: true,
      title: "Save Changes",
      message: `Are you sure you want to save your changes to ${moduleName}?`,
      type: "success",
      confirmText: "Yes, Save",
      action: async () => {
        try {
          if (moduleName === "Academic Settings") {
            await academicApi.settings.update({
              gradingSystem: academicSettings.gradingSystem,
              workingDays: Number(academicSettings.workingDays),
              startTime: academicSettings.startTime,
              periodDuration: Number(academicSettings.periodDuration),
              periodsPerDay: Number(academicSettings.periodsPerDay),
              breakAfterPeriods: parseBreakAfterPeriods(academicSettings.breakAfterPeriods),
              breakDurationMinutes: Number(academicSettings.breakDurationMinutes)
            });
          }
          if (moduleName === "Institute Profile") {
            await instituteProfileApi.update(instituteProfile);
          }
        } catch (err) {
          console.error(`Failed to save ${moduleName}`, err);
          alert(`Failed to save ${moduleName}.`);
        }
        closeModal();
      }
    });
  };

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.role || (!editingUserId && !newUser.password)) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const payload = {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      };
      if (!editingUserId) payload.status = "Active";
      if (newUser.password) payload.password_hash = newUser.password;

      if (editingUserId) {
        const updatedUser = await usersApi.update(editingUserId, payload);
        setUsersList(usersList.map((user) => user?.id === editingUserId ? updatedUser : user).filter(Boolean));
      } else {
        const createdUser = await usersApi.create(payload);
        setUsersList([createdUser, ...usersList].filter(Boolean));
      }

      resetUserForm();
      setShowAddUserForm(false);
      closeModal();
    } catch (err) {
      console.error("Failed to save user", err);
      alert("Failed to save user.");
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await usersApi.remove(id);
      setUsersList(usersList.filter(user => user.id !== id));
      closeModal();
    } catch (err) {
      console.error("Failed to delete user", err);
      alert("Failed to delete user.");
    }
  };

  const handleDeleteRole = async (id) => {
    try {
      await rolesApi.remove(id);
      setRolesList(rolesList.filter(role => role.id !== id).filter(Boolean));
      closeModal();
    } catch (err) {
      console.error("Failed to delete role", err);
      alert("Failed to delete role.");
    }
  };

  const promptDeleteRole = (role) => {
    const isSuperAdmin = String(role.name).toLowerCase() === 'super admin';
    if (isSuperAdmin) {
      alert("Super Admin role cannot be deleted.");
      return;
    }

    setModalConfig({
      isOpen: true,
      title: "Delete Role",
      message: `Are you sure you want to permanently delete the role '${role.name}'? This action cannot be undone.`,
      type: "danger",
      confirmText: "Yes, Delete",
      action: () => handleDeleteRole(role.id)
    });
  };

  const handleAddNewRole = async () => {
    if (!newRoleName.trim()) return;

    if (rolesList.some(r => r.name.toLowerCase() === newRoleName.trim().toLowerCase())) {
      alert("This role already exists!");
      return;
    }

    try {
      const createdRole = await rolesApi.create({
        name: newRoleName.trim(),
        color: "bg-slate-100 text-slate-700",
        permissions: []
      });
      setRolesList([...rolesList, createdRole].filter(Boolean));
      setNewUser({ ...newUser, role: createdRole.name });
      setShowRoleModal(false);
      setNewRoleName("");
    } catch (err) {
      console.error("Failed to add role", err);
      alert("Failed to create role.");
    }
  };

  const ALL_PERMISSIONS = ["Dashboard", "Students", "Teachers", "Fees", "Accounts", "Reports", "Settings", "All Modules", "Admission", "Attendance (own classes)", "Marks Entry", "Routine", "Fee Collection", "Payroll", "Financial Reports", "View own profile", "Dashboard (limited)"];

  const toggleRolePermission = async (targetRole, perm) => {
    const role = targetRole;
    const rolePermissions = role.permissions || [];
    const newPermissions = rolePermissions.includes(perm)
      ? rolePermissions.filter(p => p !== perm)
      : [...rolePermissions, perm];

    try {
      const updatedRole = await rolesApi.update(role.id, { permissions: newPermissions });
      setRolesList(rolesList.map((item) => item?.id === role.id ? updatedRole : item).filter(Boolean));
    } catch (err) {
      console.error("Failed to update role permissions", err);
      alert("Failed to update permissions.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">Settings</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Wednesday, June 17, 2026</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left Sidebar */}
        <div className="w-full md:w-64 shrink-0 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === tab.name
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 w-full rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
          {activeTab === "Institute Profile" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-800">Institute Profile</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">Manage your school&apos;s basic information and logo.</p>
                </div>
                <button
                  onClick={() => promptSaveSettings("Institute Profile")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Check size={16} strokeWidth={3} /> Save Changes
                </button>
              </div>

              <div className="flex items-center gap-6 mb-8">
                {logoUrl ? (
                  <img src={logoUrl} alt="Institute Logo" className="h-20 w-20 rounded-2xl object-cover shadow-md border border-slate-100 bg-white" />
                ) : (
                  <div className="h-20 w-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl font-black shadow-md shrink-0">
                    E
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition mb-2"
                  >
                    <Upload size={14} /> Change Logo
                  </button>
                  <p className="text-xs font-bold text-slate-400">PNG, JPG · max 2 MB</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Institute Name</label>
                  <input
                    type="text"
                    value={instituteProfile.name}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Institute Type</label>
                  <input
                    type="text"
                    value={instituteProfile.type}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">EIIN Number</label>
                  <input
                    type="text"
                    value={instituteProfile.eiin}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, eiin: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Phone</label>
                  <input
                    type="text"
                    value={instituteProfile.phone}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Email</label>
                  <input
                    type="email"
                    value={instituteProfile.email}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Website</label>
                  <input
                    type="text"
                    value={instituteProfile.website}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, website: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Established Year</label>
                  <input
                    type="text"
                    value={instituteProfile.establishedYear}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, establishedYear: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Total Capacity</label>
                  <input
                    type="text"
                    value={instituteProfile.capacity}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, capacity: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-500 mb-2">Address</label>
                  <textarea
                    value={instituteProfile.address}
                    onChange={(e) => setInstituteProfile({ ...instituteProfile, address: e.target.value })}
                    rows="2"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  ></textarea>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Academic Settings" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-800">Academic Settings</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">Configure academic sessions, grading scales, and class timings.</p>
                </div>
                <button
                  onClick={() => promptSaveSettings("Academic Settings")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Check size={16} strokeWidth={3} /> Save Changes
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-10">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Current Academic Year</label>
                  <input type="text" defaultValue="2024-25" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Session Start Month</label>
                  <input type="text" defaultValue="January" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Session End Month</label>
                  <input type="text" defaultValue="December" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Grading System</label>
                  <input type="text" value={academicSettings.gradingSystem} onChange={(e) => setAcademicSettings({...academicSettings, gradingSystem: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Working Days/Week</label>
                  <input type="number" value={academicSettings.workingDays} onChange={(e) => setAcademicSettings({...academicSettings, workingDays: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Class Start Time</label>
                  <input type="text" value={academicSettings.startTime} onChange={(e) => setAcademicSettings({...academicSettings, startTime: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Period Duration (min)</label>
                  <input type="number" value={academicSettings.periodDuration} onChange={(e) => setAcademicSettings({...academicSettings, periodDuration: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Periods per Day</label>
                  <input type="number" value={academicSettings.periodsPerDay} onChange={(e) => setAcademicSettings({...academicSettings, periodsPerDay: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Break After Periods</label>
                  <input
                    type="text"
                    value={Array.isArray(academicSettings.breakAfterPeriods) ? academicSettings.breakAfterPeriods.join(", ") : academicSettings.breakAfterPeriods}
                    onChange={(e) => setAcademicSettings({...academicSettings, breakAfterPeriods: e.target.value})}
                    placeholder="e.g. 3, 6"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-2">Break Duration (min)</label>
                  <input
                    type="number"
                    min="1"
                    value={academicSettings.breakDurationMinutes}
                    onChange={(e) => setAcademicSettings({...academicSettings, breakDurationMinutes: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
                  />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-4">Grade Scale</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[
                    { grade: "A+", range: "90-100", gpa: "5.0" },
                    { grade: "A", range: "80-89", gpa: "4.0" },
                    { grade: "B", range: "70-79", gpa: "3.5" },
                    { grade: "C", range: "60-69", gpa: "3.0" },
                    { grade: "D", range: "50-59", gpa: "2.0" },
                    { grade: "F", range: "0-49", gpa: "0.0" },
                  ].map((g) => (
                    <div key={g.grade} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="h-10 w-10 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm">
                        {g.grade}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          defaultValue={g.range}
                          className="block text-sm font-bold text-slate-700 w-full outline-none bg-transparent focus:text-blue-600 focus:border-b border-blue-200 transition mb-0.5 pb-0.5"
                        />
                        <div className="flex items-center text-xs font-bold text-slate-400">
                          GPA:
                          <input
                            type="text"
                            defaultValue={g.gpa}
                            className="ml-1 w-12 outline-none bg-transparent focus:text-blue-600 focus:border-b border-blue-200 transition pb-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "User Management" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-xl font-extrabold text-slate-800">User Management</h3>
                <button
                  onClick={() => {
                    if (!showAddUserForm || editingUserId) resetUserForm();
                    setShowAddUserForm(!showAddUserForm || Boolean(editingUserId));
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Plus size={16} strokeWidth={3} /> Add User
                </button>
              </div>

              {showAddUserForm && (
                <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <h4 className="text-lg font-bold text-slate-800 mb-6">{editingUserId ? "Edit User" : "New User"}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                        placeholder="Full name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="user@school.edu"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Role *</label>
                      <select
                        value={newUser.role}
                        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition cursor-pointer"
                      >
                        {rolesList.filter(Boolean).map(r => (
                          <option key={r.name} value={r.name}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                    {editingUserId && (
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Current Password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            value={newUser.currentPassword || ""}
                            readOnly
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-medium text-slate-500 outline-none cursor-not-allowed placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition"
                          >
                            {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        {editingUserId ? "New Password" : "Password *"}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder={editingUserId ? "Leave blank to keep current password" : "Temporary password"}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setShowAddUserForm(false);
                        resetUserForm();
                      }}
                      className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={promptCreateUser}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                    >
                      {editingUserId ? "Update User" : "Create User"}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-white text-xs font-extrabold uppercase text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-5 tracking-wider">User</th>
                      <th className="px-6 py-5 tracking-wider">Role</th>
                      <th className="px-6 py-5 tracking-wider">Last Login</th>
                      <th className="px-6 py-5 tracking-wider">Status</th>
                      <th className="px-6 py-5 tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {usersList.filter(Boolean).map((user) => {
                      const initial = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "U";
                      const roleColor = rolesList.filter(Boolean).find(r => r.name === user.role)?.color || "bg-slate-100 text-slate-700";
                      const protectedAdmin = isProtectedAdminUser(user);
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                {initial}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800">{user.name}</div>
                                <div className="text-xs font-medium text-slate-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${roleColor}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-500">
                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Just now"}
                          </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-emerald-500">
                            {user.status}
                          </span>
                        </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleStartEditUser(user)}
                                className="text-blue-500 hover:text-blue-700 transition"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              {!protectedAdmin && (
                                <button
                                  onClick={() => promptDeleteUser(user)}
                                  className="text-rose-500 hover:text-rose-700 transition"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <h4 className="text-lg font-bold text-slate-800">Role Permissions</h4>
                  <button
                    onClick={() => setShowRoleModal(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    <Plus size={14} strokeWidth={3} /> Add Role
                  </button>
                </div>
                <div className="space-y-6">
                {rolesList.filter(Boolean).map((role) => {
                  const isSuperAdminRole = String(role.name).toLowerCase() === 'super admin';
                  const rolePermissions = isSuperAdminRole ? ALL_PERMISSIONS : (role.permissions || []);
                  const isEditingPermissions = editingRoleIndex === role.id;
                  const roleColor = role.color || "bg-slate-100 text-slate-700";
                  
                  return (
                    <div key={role.id} className={`rounded-[24px] border bg-white p-6 transition ${isEditingPermissions ? 'border-blue-300 shadow-lg ring-4 ring-blue-50' : 'border-slate-200 shadow-sm hover:shadow-md'}`}>
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-slate-800 text-lg">{role.name}</div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${roleColor}`}>
                            Role
                          </div>
                        </div>
                        {isSuperAdminRole ? (
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">All permissions</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => isEditingPermissions ? setEditingRoleIndex(null) : setEditingRoleIndex(role.id)}
                              className={`text-sm font-bold transition flex items-center gap-2 ${isEditingPermissions ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl" : "text-blue-600 hover:text-blue-700"}`}
                            >
                              {isEditingPermissions ? <><Check size={16} strokeWidth={3} /> Done</> : "Edit Permissions"}
                            </button>
                            {!isSuperAdminRole && (
                              <button
                                onClick={() => promptDeleteRole(role)}
                                className="text-rose-500 hover:text-rose-700 transition"
                                title="Delete Role"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {isEditingPermissions ? (
                          ALL_PERMISSIONS.map((perm, pIdx) => {
                            const hasPerm = rolePermissions.includes(perm);
                            return (
                              <button
                                key={pIdx}
                                onClick={() => toggleRolePermission(role, perm)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition ${hasPerm ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm scale-105" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                                  }`}
                              >
                                {hasPerm ? <Check size={14} className="text-blue-600" strokeWidth={3} /> : <Plus size={14} className="text-slate-400" strokeWidth={3} />}
                                {perm}
                              </button>
                            );
                          })
                        ) : (
                          rolePermissions.length > 0 ? rolePermissions.map((perm, pIdx) => (
                            <div key={pIdx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
                              <Check size={14} className="text-emerald-500" strokeWidth={3} />
                              {perm}
                            </div>
                          )) : (
                            <span className="text-slate-400 text-sm font-medium italic">No permissions assigned.</span>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "System Settings" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6">
                <h3 className="text-xl font-extrabold text-slate-800">System Settings</h3>
                <button
                  onClick={() => promptSaveSettings("System Settings")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Check size={16} strokeWidth={3} /> Save Changes
                </button>
              </div>

              <div className="mb-10">
                <h4 className="text-sm font-bold text-slate-800 mb-4">Notification Settings</h4>
                <div className="space-y-4">
                  {[
                    { title: "Email Notifications", desc: "Send email alerts for fee, attendance, results", state: systemSettings.emailNotif, setter: (val) => setSystemSettings({...systemSettings, emailNotif: val}) },
                    { title: "SMS Notifications", desc: "Send SMS to parents for attendance and fees", state: systemSettings.smsNotif, setter: (val) => setSystemSettings({...systemSettings, smsNotif: val}) },
                    { title: "System Alerts", desc: "Alert admin for critical system events", state: systemSettings.systemAlerts, setter: (val) => setSystemSettings({...systemSettings, systemAlerts: val}) },
                    { title: "Newsletter", desc: "Send monthly newsletter to parents", state: systemSettings.newsletter, setter: (val) => setSystemSettings({...systemSettings, newsletter: val}) },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div>
                        <div className="text-sm font-bold text-slate-800">{item.title}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">{item.desc}</div>
                      </div>
                      <button
                        onClick={() => item.setter(!item.state)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${item.state ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${item.state ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-4">Backup & Security</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Auto Backup</label>
                    <input type="text" value={systemSettings.autoBackup} onChange={(e) => setSystemSettings({...systemSettings, autoBackup: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Backup Retention</label>
                    <input type="text" value={systemSettings.backupRetention} onChange={(e) => setSystemSettings({...systemSettings, backupRetention: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">Session Timeout</label>
                    <input type="text" value={systemSettings.sessionTimeout} onChange={(e) => setSystemSettings({...systemSettings, sessionTimeout: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 mb-2">2FA Authentication</label>
                    <input type="text" value={systemSettings.twoFactorAuth} onChange={(e) => setSystemSettings({...systemSettings, twoFactorAuth: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition" />
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl bg-blue-50 text-blue-600 px-4 py-3 text-sm font-medium border border-blue-100">
                  <div className="shrink-0 h-4 w-4 rounded-full border-[1.5px] border-blue-600 flex items-center justify-center font-bold text-[10px]">i</div>
                  Last backup: Today at 02:00 AM · 12.4 MB · All systems normal
                </div>
              </div>
            </div>
          )}

          {activeTab !== "Institute Profile" && activeTab !== "Academic Settings" && activeTab !== "User Management" && activeTab !== "System Settings" && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-in fade-in duration-300">
              <SettingsIcon size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-bold">{activeTab} coming soon...</p>
            </div>
          )}
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

      <ConfirmModal
        isOpen={showRoleModal}
        title="Add New Role"
        message="Create a new custom role. You can assign permissions from User Management."
        type="info"
        confirmText="Add Role"
        onConfirm={handleAddNewRole}
        onCancel={() => { setShowRoleModal(false); setNewRoleName(""); }}
      >
        <div className="mt-2">
          <label className="block text-sm font-bold text-slate-700 mb-2">Role Name</label>
          <input
            type="text"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            placeholder="e.g. Librarian, IT Staff"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition"
            autoFocus
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
