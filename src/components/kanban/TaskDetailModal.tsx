import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { KanbanTask, TaskAttachment, KanbanColumnId } from '../../types';
import { generateMockScreenshot } from '../../data/mockData';
import { 
  X, Paperclip, MessageSquare, Clock, Calendar, 
  Send, User, AlertCircle, Sparkles, Image as ImageIcon, 
  Maximize2, Download, Trash2, ArrowRight, CheckCircle2, 
  Check, FileUp, Clipboard, CheckSquare, Plus, Play, Pause 
} from 'lucide-react';

interface TaskDetailModalProps {
  task: KanbanTask;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose }) => {
  const { 
    currentUser, 
    attachScreenshotToTask, 
    addCommentToTask, 
    moveTask, 
    toggleSubtask,
    activeTrackingTaskId,
    toggleTaskTimer,
    addToast 
  } = useApp();

  const [commentText, setCommentText] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [newSubtaskText, setNewSubtaskText] = useState<string>('');

  const isTrackingThis = activeTrackingTaskId === task.id;

  // REAL Clipboard Paste Listener (Ctrl+V anywhere in modal!)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                attachScreenshotToTask(task.id, {
                  name: `clipboard-paste-${Date.now().toString().slice(-4)}.png`,
                  url: event.target.result as string,
                  isClipboardPaste: true,
                  sizeBytes: file.size,
                });
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [task.id, attachScreenshotToTask]);

  // Quick 1-click sample screenshot paste for testing
  const handleSimulateClipboardPaste = () => {
    const mockUrl = generateMockScreenshot(`Console Bug Capture // #${task.id}`, '#ec4899');
    attachScreenshotToTask(task.id, {
      name: `pasted-sc-capture-${Date.now().toString().slice(-4)}.png`,
      url: mockUrl,
      isClipboardPaste: true,
      sizeBytes: 154200,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          attachScreenshotToTask(task.id, {
            name: file.name,
            url: event.target.result as string,
            isClipboardPaste: false,
            sizeBytes: file.size,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addCommentToTask(task.id, commentText);
    setCommentText('');
    addToast('Comment Posted', `Added update to task ${task.id}`, 'info');
  };

  const completedSubtasksCount = task.subtasks?.filter(st => st.completed).length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;
  const subtaskProgress = totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

  const columns: { id: KanbanColumnId; label: string }[] = [
    { id: 'backlog', label: 'Backlog' },
    { id: 'todo', label: 'To Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'review', label: 'Review / QA' },
    { id: 'done', label: 'Done' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg border border-brand-200 dark:border-brand-500/20">
              {task.id}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              in project <strong className="text-slate-900 dark:text-white">{task.projectName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Timer Tracking Button */}
            <button
              onClick={() => toggleTaskTimer(task.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isTrackingThis
                  ? 'bg-emerald-500 text-slate-950 animate-pulse font-bold'
                  : 'bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
              }`}
            >
              {isTrackingThis ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isTrackingThis ? 'Tracking Production...' : 'Track Time on Card'}</span>
            </button>

            {/* Column Selector */}
            <select
              value={task.columnId}
              onChange={(e) => moveTask(task.id, e.target.value as KanbanColumnId)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-brand-500"
            >
              {columns.map(col => (
                <option key={col.id} value={col.id}>Status: {col.label}</option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Two Columns */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Left Column (Title, Description, Checklist, SC Attachments, Comments) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Task Title */}
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
                {task.title}
              </h2>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Description & Acceptance Criteria
              </label>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {task.description}
              </div>
            </div>

            {/* SUBTASKS & CHECKLIST */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  Sprint Subtasks ({completedSubtasksCount}/{totalSubtasksCount})
                </span>
                <span className="font-mono text-brand-600 dark:text-brand-400">{subtaskProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>

              {/* Checklist items */}
              <div className="space-y-1.5 pt-1">
                {task.subtasks?.map(st => (
                  <label 
                    key={st.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer text-xs transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => toggleSubtask(task.id, st.id)}
                      className="rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-0"
                    />
                    <span className={st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}>
                      {st.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* SCREENSHOT & ATTACHMENT DOCK ("sc attach support") */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Screenshot & Attachment Dock ({task.attachments.length})
                  </label>
                </div>
                <span className="text-[10px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-500/20 font-mono font-semibold">
                  Ctrl + V to Paste
                </span>
              </div>

              {/* Paste & Drop Zone */}
              <div 
                className={`p-4 rounded-2xl border-2 border-dashed transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
                  isDragOver 
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' 
                    : 'border-slate-300 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        attachScreenshotToTask(task.id, {
                          name: file.name,
                          url: event.target.result as string,
                          isClipboardPaste: false,
                          sizeBytes: file.size,
                        });
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              >
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                    <Clipboard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Instant Screenshot Paste Active
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Copy screenshot to clipboard and press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] border border-slate-300 dark:border-slate-700">Ctrl + V</kbd> anywhere!
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Simulate Paste Demo Button */}
                  <button
                    type="button"
                    onClick={handleSimulateClipboardPaste}
                    className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-600/30 hover:bg-brand-100 dark:hover:bg-brand-600/50 text-brand-700 dark:text-brand-200 border border-brand-300 dark:border-brand-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Paste Sample SC</span>
                  </button>

                  {/* Real File Upload */}
                  <label className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:border-transparent dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-all">
                    <FileUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Browse</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Attachment Thumbnails Grid */}
              {task.attachments.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {task.attachments.map((att) => (
                    <div 
                      key={att.id}
                      onClick={() => setLightboxImage(att.url)}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500/60 transition-all shadow-sm"
                    >
                      <div className="h-28 w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                        <img 
                          src={att.url} 
                          alt={att.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      </div>
                      
                      <div className="p-2 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px]">
                        <span className="text-slate-700 dark:text-slate-300 truncate font-mono max-w-[100px]">{att.name}</span>
                        {att.isClipboardPaste && (
                          <span className="px-1.5 py-0.2 rounded bg-pink-50 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 text-[9px] font-bold border border-pink-200 dark:border-transparent">
                            Pasted
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="p-2 rounded-xl bg-brand-600 text-white shadow-lg">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* THREADED COMMENTS SECTION */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Discussion & Team Activity ({task.comments.length})
                </label>
              </div>

              {/* Add Comment Box */}
              <form onSubmit={handlePostComment} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 mt-1">
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a feedback comment or mention @team..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>

              {/* Comments Stream */}
              <div className="space-y-2.5 pt-2">
                {task.comments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No comments yet. Be the first to share an update.</p>
                ) : (
                  task.comments.map((comm) => (
                    <div key={comm.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <img src={comm.authorAvatar} alt="" className="w-5 h-5 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                          <span className="font-bold text-slate-900 dark:text-white">{comm.authorName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{comm.createdAt}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 pl-7 leading-relaxed">{comm.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Sidebar Metadata */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Status & Priority Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Priority</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase inline-block ${
                  task.priority === 'urgent' ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30' :
                  task.priority === 'high' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30' :
                  'bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                }`}>
                  {task.priority}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Assignee</span>
                <div className="flex items-center gap-2">
                  <img src={task.assignee.avatar} alt="" className="w-6 h-6 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                  <span className="font-semibold text-slate-900 dark:text-white">{task.assignee.name}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Reporter</span>
                <div className="flex items-center gap-2">
                  <img src={task.reporter.avatar} alt="" className="w-6 h-6 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
                  <span className="text-slate-700 dark:text-slate-300">{task.reporter.name}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Due Date</span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>{task.dueDate}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Hours Logged</span>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{Math.round(task.spentProductionSeconds / 3600)}h / {task.estimatedHours}h Est.</span>
                </div>
              </div>
            </div>

            {/* Labels Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">Labels</span>
              <div className="flex flex-wrap gap-1.5">
                {task.labels.map(lbl => (
                  <span key={lbl} className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent text-[10px] font-mono">
                    #{lbl}
                  </span>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-500/20 text-[11px] text-slate-600 dark:text-slate-400">
              💡 <strong>Pro-Tip:</strong> Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-900 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-500/30 rounded font-mono shadow-xs">Ctrl + V</kbd> anywhere on this modal to paste screenshots from your clipboard directly!
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[85vh] p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl relative shadow-2xl">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightboxImage} alt="Attachment Full Preview" className="max-w-full max-h-[80vh] rounded-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};
