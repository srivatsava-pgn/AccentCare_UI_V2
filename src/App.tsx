import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { LoginPage } from "./components/auth/LoginPage";
import { CodingInterface } from "./components/coding-interface/CodingInterface";
import { DashboardView } from "./components/dashboard/DashboardView";
import { useAuth } from "./hooks/useAuth";
import { useCodingResultsApi } from "./hooks/useCodingResultsApi";
import { useDocumentApi } from "./hooks/useDocumentApi";
import { apiClient } from "./services/apiClient";

// Add timer controls to window
declare global {
  interface Window {
    timerControls?: {
      startTimer: (initialTime: string) => void;
      stopTimer: () => void;
      getCurrentTime: () => string;
    };
  }
}

const HomeHealthCodingInterface = () => {
  // Core state management hooks
  const auth = useAuth();

  // Local component state
  const [showDashboard, setShowDashboard] = useState(true);
  const [selectedEpisodeDocId, setSelectedEpisodeDocId] = useState<
    string | null
  >(null);
  const [currentTime, setCurrentTime] = useState("00:00:00");

  // API hooks
  const {
    documents,
    documentContent,
    loading: documentsLoading,
    error: documentsError,
  } = useDocumentApi(selectedEpisodeDocId);
  const {
    primarySuggestions,
    secondarySuggestions,
    reviewStats,
    comments,
    loading: codingLoading,
    error: codingError,
  } = useCodingResultsApi(selectedEpisodeDocId);

  // Timer functions
  const getTime = async (documentId: string) => {
    try {
      const response = await apiClient.getTime(documentId);
      return response.accumulated_time || "00:00:00";
    } catch (error) {
      console.error("Error getting time:", error);
      return "00:00:00";
    }
  };

  const submitTime = async (documentId: string, timeSpent: string) => {
    try {
      await apiClient.submitTime(documentId, timeSpent);
      console.log("Time submitted successfully");
    } catch (error) {
      console.error("Error submitting time:", error);
    }
  };

  // Event handlers
  const startCoding = async (docId: string) => {
    setSelectedEpisodeDocId(docId);
    setShowDashboard(false);

    // Get current time for this document
    const accumulatedTime = await getTime(docId);
    setCurrentTime(accumulatedTime);
  };

  const returnToDashboard = async () => {
    // Submit current time before returning to dashboard
    if (selectedEpisodeDocId && window.timerControls) {
      const timeToSubmit = window.timerControls.getCurrentTime();
      await submitTime(selectedEpisodeDocId, timeToSubmit);
      window.timerControls.stopTimer();
    }

    setShowDashboard(true);
    setSelectedEpisodeDocId(null);
    setCurrentTime("00:00:00");
  };

  const handleLogout = async () => {
    // Submit current time before logout
    if (selectedEpisodeDocId && window.timerControls) {
      const timeToSubmit = window.timerControls.getCurrentTime();
      await submitTime(selectedEpisodeDocId, timeToSubmit);
      window.timerControls.stopTimer();
    }

    auth.logout();
    setShowDashboard(true);
    setSelectedEpisodeDocId(null);
    setCurrentTime("00:00:00");
    window.location.reload();
  };

  const handleTimerUpdate = (newTime: string) => {
    setCurrentTime(newTime);
  };

  // Handle page refresh/unload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (selectedEpisodeDocId && window.timerControls) {
        const timeToSubmit = window.timerControls.getCurrentTime();
        await submitTime(selectedEpisodeDocId, timeToSubmit);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [selectedEpisodeDocId]);

  // Render different views based on state
  if (!auth.isLoggedIn) {
    return (
      <LoginPage
        credentials={auth.credentials}
        setCredentials={auth.setCredentials}
        onLogin={auth.login}
        isLoggingIn={auth.isLoggingIn}
        loginError={auth.loginError}
      />
    );
  }

  if (showDashboard) {
    return (
      <DashboardView onStartCoding={startCoding} onLogout={handleLogout} />
    );
  }

  // Show loading state while documents or coding results are being fetched
  if (documentsLoading || codingLoading) {
    return (
      <div className="flex h-screen bg-gray-50 font-sans items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-semibold text-gray-700">
            {documentsLoading
              ? "Loading documents..."
              : "Loading coding results..."}
          </p>
        </div>
      </div>
    );
  }

  // Show error state if documents or coding results failed to load
  if (documentsError || codingError) {
    return (
      <div className="flex h-screen bg-gray-50 font-sans items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Failed to Load Data
          </h2>
          <p className="text-gray-600 mb-4">{documentsError || codingError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={returnToDashboard}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main coding interface
  return (
    <CodingInterface
      selectedEpisodeDocId={selectedEpisodeDocId!}
      documents={documents}
      documentContent={documentContent}
      primarySuggestions={primarySuggestions}
      secondarySuggestions={secondarySuggestions}
      reviewStats={reviewStats}
      comments={comments}
      onReturnToDashboard={returnToDashboard}
      onLogout={handleLogout}
      timerStartTime={currentTime}
      onTimerUpdate={handleTimerUpdate}
    />
  );
};

export default HomeHealthCodingInterface;
