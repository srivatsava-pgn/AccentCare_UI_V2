import MarkdownPreview from "@uiw/react-markdown-preview";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  MessageSquare,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import React, { useRef } from "react";
import { CodeSuggestion as CodeSuggestionType, Comment } from "../../types";

interface CodeSuggestionProps {
  suggestion: CodeSuggestionType;
  index: number;
  isPrimary?: boolean;
  showUndo?: boolean;
  undoAction?: ((codeId: string) => void) | null;
  showMoveActions?: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  isExpanded: boolean;
  existingComments: Comment[];
  isAddingNewComment: boolean;
  commentEditMode: Set<string>;
  tempComments: Record<string, string>;
  onAccept: (codeId: string) => void;
  onReject: (codeId: string) => void;
  onToggleExpanded: (codeId: string) => void;
  onStartAddingComment: (codeId: string) => void;
  onStartEditingComment: (codeId: string, commentId: string) => void;
  onSubmitNewComment: (codeId: string) => void;
  onSubmitEditComment: (codeId: string, commentId: string) => void;
  onCancelNewComment: (codeId: string) => void;
  onCancelEditComment: (codeId: string, commentId: string) => void;
  onCommentChange: (key: string, value: string, cursorPosition: number) => void;
  onNavigateToEvidence: (evidence: any) => void;
  onMoveToSecondary?: (codeId: string) => void;
  onMoveToPrimary?: (codeId: string) => void;
  // NEW: dnd-kit props
  dragHandleProps?: any;
  isDragging?: boolean;
}

export const CodeSuggestion: React.FC<CodeSuggestionProps> = ({
  suggestion,
  index,
  isPrimary = false,
  showUndo = false,
  undoAction = null,
  showMoveActions = false,
  isAccepted,
  isRejected,
  isExpanded,
  existingComments,
  isAddingNewComment,
  commentEditMode,
  tempComments,
  onAccept,
  onReject,
  onToggleExpanded,
  onStartAddingComment,
  onStartEditingComment,
  onSubmitNewComment,
  onSubmitEditComment,
  onCancelNewComment,
  onCancelEditComment,
  onCommentChange,
  onNavigateToEvidence,
  onMoveToSecondary,
  onMoveToPrimary,
  dragHandleProps,
  isDragging = false,
}) => {
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement>>({});
  const isPending = !isAccepted && !isRejected;
  const hasExistingComments = existingComments.length > 0;

  return (
    <div
      className={`border rounded-lg p-3 mb-2 bg-white transition-all duration-300 relative ${
        isDragging
          ? "opacity-60 shadow-2xl border-blue-300 z-50" // UPDATED: More transparent (0.6 -> 0.6)
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Single Line Layout */}
      <div className="flex items-center justify-between gap-2">
        {/* Left side: Drag handle + Move Actions + ICD info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* NEW: dnd-kit Drag Handle */}
          {!showUndo && dragHandleProps && (
            <div
              {...dragHandleProps}
              className="p-1.5 rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing hover:bg-blue-100 hover:text-blue-600"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          {/* Move Actions - next to drag handle */}
          {showMoveActions && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isPrimary && onMoveToSecondary) {
                  onMoveToSecondary(suggestion.id);
                } else if (!isPrimary && onMoveToPrimary) {
                  onMoveToPrimary(suggestion.id);
                }
              }}
              className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 interactive-button ${
                isPrimary
                  ? "bg-green-100 hover:bg-green-200 text-green-700"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-700"
              }`}
              title={isPrimary ? "Move to Secondary" : "Move to Primary"}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isPrimary ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                )}
              </svg>
            </button>
          )}

          {/* ICD Code - Color coded by type */}
          <span
            className={`px-3 py-2 rounded-full text-sm font-bold flex-shrink-0 transition-all duration-200 ${
              isPrimary ? "bg-green-600 text-white" : "bg-blue-600 text-white"
            }`}
          >
            {suggestion.code}
          </span>

          {/* Description */}
          <span className="text-gray-800 font-semibold text-sm truncate flex-1">
            {suggestion.description}
          </span>

          {/* Manual/AI Indicator */}
          {suggestion.isManuallyAdded ? (
            <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700 border border-purple-300 flex-shrink-0 font-semibold transition-all duration-200">
              Manual
            </span>
          ) : (
            <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 border border-green-300 flex-shrink-0 font-semibold transition-all duration-200">
              AI
            </span>
          )}

          {/* Comments Indicator */}
          {hasExistingComments && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <MessageSquare className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-semibold text-blue-600">
                {existingComments.length}
              </span>
            </div>
          )}
        </div>

        {/* Right side: Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Undo Button (only in filtered views) */}
          {showUndo && undoAction && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                undoAction(suggestion.id);
              }}
              className="p-1.5 rounded-full bg-orange-100 hover:bg-orange-200 text-orange-700 transition-all duration-200 interactive-button"
              title="Undo"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}

          {/* Accept/Reject Buttons - only for AI suggestions in main view */}
          {!showUndo && !suggestion.isManuallyAdded && isPending && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAccept(suggestion.id);
                }}
                className="p-1.5 rounded-full bg-green-100 hover:bg-green-200 text-green-700 transition-all duration-200 interactive-button"
                title="Accept"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onReject(suggestion.id);
                }}
                className="p-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 transition-all duration-200 interactive-button"
                title="Reject"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}

          {/* Status Display */}
          {!showUndo && (isAccepted || suggestion.isManuallyAdded) && (
            <div className="flex items-center gap-1 text-green-700 bg-green-100 px-2 py-1 rounded-full transition-all duration-200">
              <Check className="w-3 h-3" />
              <span className="text-xs font-semibold">
                {suggestion.isManuallyAdded ? "Added" : "Accepted"}
              </span>
            </div>
          )}
          {!showUndo && isRejected && !suggestion.isManuallyAdded && (
            <div className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded-full transition-all duration-200">
              <X className="w-3 h-3" />
              <span className="text-xs font-semibold">Rejected</span>
            </div>
          )}

          {/* Expand Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleExpanded(suggestion.id);
            }}
            className="p-1.5 rounded-full text-blue-600 hover:bg-blue-100 transition-all duration-200 interactive-button"
            title={isExpanded ? "Collapse" : "Expand Details"}
          >
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content - Show in all views */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-4">
          {/* Description */}
          <div>
            <p className="text-gray-800 font-semibold text-sm">
              {suggestion.description}
            </p>
          </div>

          {/* AI Reasoning - Only show for non-manually added codes */}
          {!suggestion.isManuallyAdded && suggestion.aiReasoning && (
            <div>
              <h4 className="font-bold text-gray-800 mb-2 text-sm">
                AI Reasoning
              </h4>
              <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-200 font-medium">
                <style>
                  {`
                      .w-md-editor-text-area .anchor {
                        display: none !important;
                      }
                      .wmde-markdown .anchor {
                        display: none !important;
                      }
                      .wmde-markdown h1 .anchor,
                      .wmde-markdown h2 .anchor,
                      .wmde-markdown h3 .anchor,
                      .wmde-markdown h4 .anchor,
                      .wmde-markdown h5 .anchor,
                      .wmde-markdown h6 .anchor {
                        display: none !important;
                      }
                      .wmde-markdown .octicon-link {
                        display: none !important;
                      }
                    `}
                </style>
                <MarkdownPreview
                  source={String(suggestion.aiReasoning)}
                  data-color-mode="light"
                  style={{
                    backgroundColor: "transparent",
                    fontSize: "13px",
                    color: "#374151",
                  }}
                  components={{
                    h2: ({ children, ...props }) => (
                      <h3
                        {...props}
                        className="font-bold text-gray-800 mt-3 mb-2 text-sm"
                      >
                        {children}
                      </h3>
                    ),
                    h3: ({ children, ...props }) => (
                      <h4
                        {...props}
                        className="font-semibold text-gray-800 mt-2 mb-1 text-sm"
                      >
                        {children}
                      </h4>
                    ),
                  }}
                />
              </div>
            </div>
          )}
          {/* Supporting Evidence - Only show for non-manually added codes */}
          {!suggestion.isManuallyAdded && (
            <div>
              <h4 className="font-bold text-gray-800 mb-2 text-sm">
                Supporting Evidence
              </h4>
              <ul className="space-y-2">
                {suggestion.supportingSentences.map((evidence, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-700 bg-gray-50 p-2 rounded"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1">
                        <p className="mb-1 font-medium">{evidence.text}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-semibold">
                            {evidence.document}
                          </span>
                          <span>•</span>
                          <span className="font-medium">
                            Page {evidence.page}
                          </span>
                          <button
                            onClick={() => onNavigateToEvidence(evidence)}
                            className="ml-2 text-blue-600 hover:text-blue-700 flex items-center gap-1 font-semibold transition-all duration-200 interactive-button"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comments Section - Show in ALL views */}
          <div>
            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4" />
              Comments
            </h4>

            {/* Show existing comments */}
            {hasExistingComments && (
              <div className="space-y-2 mb-3">
                {existingComments.map((comment) => {
                  const commentKey = `edit-${suggestion.id}-${comment.id}`;
                  const isEditingThisComment = commentEditMode.has(commentKey);

                  return (
                    <div
                      key={comment.id}
                      className="bg-gray-50 p-3 rounded border transition-all duration-200"
                    >
                      {!isEditingThisComment ? (
                        <>
                          <p className="text-sm text-gray-700 mb-2 font-medium">
                            {comment.text}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                              <span className="font-semibold text-blue-600 italic">
                                {comment.user}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(comment.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                onStartEditingComment(suggestion.id, comment.id)
                              }
                              className="text-blue-600 hover:text-blue-700 text-xs font-semibold transition-all duration-200"
                            >
                              Edit
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            ref={(el) => {
                              if (el) {
                                textareaRefs.current[commentKey] = el;
                              }
                            }}
                            value={tempComments[commentKey] || ""}
                            onChange={(e) => {
                              const cursorPosition = e.target.selectionStart;
                              onCommentChange(
                                commentKey,
                                e.target.value,
                                cursorPosition
                              );
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm resize-none focus:border-blue-500 focus:outline-none font-medium focus-ring"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                onSubmitEditComment(suggestion.id, comment.id)
                              }
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-all duration-200 font-semibold interactive-button"
                            >
                              Save
                            </button>
                            <button
                              onClick={() =>
                                onCancelEditComment(suggestion.id, comment.id)
                              }
                              className="px-2 py-1 border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50 transition-all duration-200 font-semibold interactive-button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Always show add comment button when not adding a new comment */}
            {!isAddingNewComment && (
              <button
                onClick={() => onStartAddingComment(suggestion.id)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm px-3 py-2 border border-blue-300 rounded hover:bg-blue-50 transition-all duration-200 font-semibold interactive-button"
              >
                <Plus className="w-4 h-4" />
                Add Comment
              </button>
            )}

            {/* Show add new comment interface */}
            {isAddingNewComment && (
              <div className="space-y-3">
                <textarea
                  ref={(el) => {
                    if (el) {
                      textareaRefs.current[`new-${suggestion.id}`] = el;
                    }
                  }}
                  value={tempComments[`new-${suggestion.id}`] || ""}
                  onChange={(e) => {
                    const cursorPosition = e.target.selectionStart;
                    onCommentChange(
                      `new-${suggestion.id}`,
                      e.target.value,
                      cursorPosition
                    );
                  }}
                  placeholder="Add your notes or reasoning for this code..."
                  className="w-full p-2 border border-gray-300 rounded text-sm resize-none focus:border-blue-500 focus:outline-none font-medium focus-ring"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => onSubmitNewComment(suggestion.id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-all duration-200 font-semibold interactive-button"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => onCancelNewComment(suggestion.id)}
                    className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-all duration-200 font-semibold interactive-button"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
