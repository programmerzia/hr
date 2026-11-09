import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KanbanTask, KanbanColumnId, TaskPriority } from '../../types';
import { TaskDetailModal } from './TaskDetailModal';
import { 
  KanbanSquare, Plus, Paperclip, MessageSquare, Clock, 
  ChevronRight, ChevronLeft, Search, Filter, Sparkles, 
  Calendar, Layers, CheckCircle2, Play, Pause, CheckSquare, 
  ListFilter, LayoutGrid 
} from 'lucide-react';

export const KanbanBoardView: React.FC = () => {
  const { 
    tasks, 
    moveTask, 
    addTask, 
    activeTaskModal, 
    setActiveTaskModal,
    activeTrackingTaskId,
    toggleTaskTimer,
    currentRole 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  // New task form state
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newEstimatedHours, setNewEstimatedHours] = useState<number>(8);
  const [newProject, setNewProject] = useState<string>('Vivacom Pulse Core');

  const columns: { id: KanbanColumnId; label: string; dotColor: string }[] = [
    { id: 'backlog', label: 'Backlog', dotColor: 'bg-slate-500' },
    { id: 'todo', label: 'To Do', dotColor: 'bg-blue-500' },
    { id: 'in_progress', label: 'In Progress', dotColor: 'bg-amber-500' },
    { id: 'review', label: 'Code Review / QA', dotColor: 'bg-purple-500' },
    { id: 'done', label: 'Done', dotColor: 'bg-emerald-500' },
  ];

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesProject = projectFilter === 'all' || t.projectName === projectFilter;
    return matchesSearch && matchesPriority && matchesProject;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addTask({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      estimatedHours: Number(newEstimatedHours) || 8,
      projectName: newProject,
      columnId: 'todo',
    });
    setNewTitle('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  const getNextColumn = (curr: KanbanColumnId): KanbanColumnId | null => {
    const order: KanbanColumnId[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(curr);
    return idx < order.length - 1 ? order[idx + 1] : null;
  };

  const getPrevColumn = (curr: KanbanColumnId): KanbanColumnId | null => {
    const order: KanbanColumnId[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(curr);
    return idx > 0 ? order[idx - 1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Board Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <KanbanSquare className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Agile Projects & Task Delivery
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 font-mono">
              PULSE-SPRINT-14
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Linear/Trello-style agile delivery with direct clipboard screenshot dock (`Ctrl+V`) and production time linking
          </p>
        </div>

        {/* View mode toggle & Create Button */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'board' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'list' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>List / Table</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Project Scope Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500 font-medium"
          >
            <option value="all">All Projects</option>
            <option value="Vivacom Pulse Core">Vivacom Pulse Core</option>
            <option value="Apex Telematics">Apex Telematics</option>
            <option value="Fleet Mobile PWA">Fleet Mobile PWA</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500 font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Active Timer Indicator */}
        {activeTrackingTaskId && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Billing Time Synced: #{activeTrackingTaskId}</span>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: KANBAN COLUMNS */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter(t => t.columnId === col.id);

            return (
              <div
                key={col.id}
                className="bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col max-h-[82vh] overflow-hidden shadow-xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}></span>
                    <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">{col.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-transparent">
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks Container */}
                <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-xs border border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl">
                      No cards
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isTrackingThis = activeTrackingTaskId === task.id;
                      const completedSt = task.subtasks?.filter(st => st.completed).length || 0;
                      const totalSt = task.subtasks?.length || 0;

                      return (
                        <div
                          key={task.id}
                          onClick={() => setActiveTaskModal(task)}
                          className={`group bg-white dark:bg-slate-950/90 border rounded-xl p-3.5 cursor-pointer shadow-sm transition-all hover:-translate-y-0.5 relative space-y-2.5 ${
                            isTrackingThis
                              ? 'border-emerald-500 dark:border-emerald-500/80 shadow-emerald-500/10'
                              : 'border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-500/60 hover:shadow-md'
                          }`}
                        >
                          {/* Priority Tag & Key */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono text-brand-600 dark:text-brand-400 font-bold">{task.id}</span>
                            <div className="flex items-center gap-1.5">
                              {isTrackingThis && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold font-mono text-[9px] animate-pulse">
                                  TIMING
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                                task.priority === 'urgent' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' :
                                task.priority === 'high' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                                'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-xs font-bold text-slate-800 group-hover:text-brand-600 dark:text-slate-200 dark:group-hover:text-white leading-snug">
                            {task.title}
                          </h4>

                          {/* Screenshot Cover Preview if Attachments Exist */}
                          {task.attachments.length > 0 && (
                            <div className="h-20 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-900 relative">
                              <img 
                                src={task.attachments[0].url} 
                                alt="" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                              />
                              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-[9px] font-mono text-white flex items-center gap-1 shadow-sm">
                                <Paperclip className="w-2.5 h-2.5 text-brand-300" />
                                <span>{task.attachments.length} SC</span>
                              </div>
                            </div>
                          )}

                          {/* Subtasks Progress */}
                          {totalSt > 0 && (
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <CheckSquare className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                              <span>{completedSt}/{totalSt} subtasks</span>
                            </div>
                          )}

                          {/* Card Footer: Assignee, Timer Button & Time */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <img src={task.assignee.avatar} alt="" className="w-5 h-5 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[70px]">
                                {task.assignee.name.split(' ')[0]}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-mono">
                              {/* 1-Click Track Time Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskTimer(task.id);
                                }}
                                className={`p-1 rounded-md transition-colors ${
                                  isTrackingThis
                                    ? 'bg-emerald-500 text-slate-950 font-bold'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                                }`}
                                title={isTrackingThis ? 'Stop Tracking' : 'Track Active Production'}
                              >
                                {isTrackingThis ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                              </button>

                              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Clock className="w-3 h-3" />
                                {Math.round(task.spentProductionSeconds / 3600)}h
                              </span>
                            </div>
                          </div>

                          {/* Quick Shift Columns (< >) */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between pt-1 text-[10px]">
                            {getPrevColumn(col.id) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(task.id, getPrevColumn(col.id)!);
                                }}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-0.5"
                              >
                                <ChevronLeft className="w-3 h-3" /> Back
                              </button>
                            ) : <span />}

                            {getNextColumn(col.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveTask(task.id, getNextColumn(col.id)!);
                                }}
                                className="p-1 rounded bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-0.5 font-bold shadow-xs"
                              >
                                Advance <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW MODE 2: DETAILED TABLE / LIST VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Title</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Assignee</th>
                  <th className="p-3.5">Subtasks</th>
                  <th className="p-3.5">SC Attach</th>
                  <th className="p-3.5">Time Logged</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/60">
                {filteredTasks.map((t) => (
                  <tr 
                    key={t.id} 
                    onClick={() => setActiveTaskModal(t)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-mono text-brand-600 dark:text-brand-400 font-bold">{t.id}</td>
                    <td className="p-3.5 font-medium text-slate-900 dark:text-white max-w-sm truncate">{t.title}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                        {t.columnId.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.priority === 'urgent' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' :
                        t.priority === 'high' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                        'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <img src={t.assignee.avatar} alt="" className="w-5 h-5 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                        <span className="text-slate-700 dark:text-slate-200 font-medium">{t.assignee.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                      {t.subtasks?.filter(st => st.completed).length || 0}/{t.subtasks?.length || 0}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {t.attachments.length > 0 ? (
                        <span className="flex items-center gap-1 text-brand-600 dark:text-brand-300 font-bold">
                          <Paperclip className="w-3 h-3" />
                          {t.attachments.length}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(t.spentProductionSeconds / 3600)}h / {t.estimatedHours}h
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskTimer(t.id);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-xs transition-all ${
                          activeTrackingTaskId === t.id
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {activeTrackingTaskId === t.id ? 'Tracking' : 'Start Timer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {activeTaskModal && (
        <TaskDetailModal
          task={activeTaskModal}
          onClose={() => setActiveTaskModal(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Create Agile Issue / Task</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Add a new deliverable card to the sprint board</p>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement Web Push Notifications for Shift Clock-in"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Project Workspace</label>
                <select
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Vivacom Pulse Core">Vivacom Pulse Core</option>
                  <option value="Vivacom ERP 2.0">Vivacom ERP 2.0</option>
                  <option value="Apex Telematics">Apex Telematics</option>
                  <option value="Fleet Mobile PWA">Fleet Mobile PWA</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detailed specifications or reproduction steps..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    value={newEstimatedHours}
                    onChange={(e) => setNewEstimatedHours(Number(e.target.value))}
                    min={1}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-500/25"
                >
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
