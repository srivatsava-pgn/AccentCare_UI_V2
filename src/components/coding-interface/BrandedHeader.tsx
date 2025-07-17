import {
  ChevronDown,
  Clock,
  LayoutDashboard,
  LogOut,
  User,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import PenguinLogo from "../../../public/images/penguin-logo.svg";

import Penguin from "../../../public/images/Penguinai-name.png";
interface BrandedHeaderProps {
  selectedEpisodeDocId: string;
  onReturnToDashboard: () => void;
  onLogout: () => void;
  timerStartTime?: string;
  onTimerUpdate?: (time: string) => void;
}

export const BrandedHeader: React.FC<BrandedHeaderProps> = ({
  selectedEpisodeDocId,
  onReturnToDashboard,
  onLogout,
  timerStartTime = "00:00:00",
  onTimerUpdate,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(timerStartTime);
  const [isTimerRunning, setIsTimerRunning] = useState(true); // Start timer immediately

  // Parse time string (HH:MM:SS) to seconds
  const parseTimeToSeconds = (timeString: string): number => {
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  };

  // Format seconds to HH:MM:SS
  const formatSecondsToTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Initialize timer with the provided start time
  useEffect(() => {
    setCurrentTime(timerStartTime);
    setIsTimerRunning(true);
  }, [timerStartTime]);

  // Expose timer controls to parent
  useEffect(() => {
    window.timerControls = {
      startTimer: (initialTime: string) => {
        setCurrentTime(initialTime);
        setIsTimerRunning(true);
      },
      stopTimer: () => {
        setIsTimerRunning(false);
      },
      getCurrentTime: () => currentTime,
    };
  }, [currentTime]);

  // Timer effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isTimerRunning) {
      intervalId = setInterval(() => {
        setCurrentTime((prevTime) => {
          const newSeconds = parseTimeToSeconds(prevTime) + 1;
          const newTime = formatSecondsToTime(newSeconds);

          // Call onTimeUpdate if provided
          if (onTimerUpdate) {
            onTimerUpdate(newTime);
          }

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTimerRunning, onTimerUpdate]);

  const handleLogout = () => {
    setShowUserMenu(false);
    onLogout();
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Logo, Company Name, and Episode ID */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={PenguinLogo} alt="PenguinAI Logo" className="w-8 h-8" />
            <img src={Penguin} alt="PenguinAI" className="h-6" />
          </div>

          {/* Episode Info - Moved next to logo */}
          <div className="bg-blue-100 px-3 py-1 rounded-lg">
            <div className="text-sm font-bold text-blue-800">
              Episode: {selectedEpisodeDocId}
            </div>
          </div>

          {/* Timer Display */}
          <div className="bg-green-100 px-3 py-1 rounded-lg flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <div className="text-sm font-bold text-green-800">
              {currentTime}
            </div>
          </div>
        </div>

        {/* Right side - Dashboard Button and User Profile */}
        <div className="flex items-center gap-3">
          {/* Dashboard Button */}
          <button
            onClick={onReturnToDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          {/* User Profile with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                <span style={{ textTransform: "capitalize" }}>
                  {localStorage.getItem("username")?.split("@")[0]}
                </span>
              </span>
              <ChevronDown
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  showUserMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {/* User Info Section */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div
                        className="text-sm text-gray-600"
                        style={{ textTransform: "capitalize" }}
                      >
                        {localStorage.getItem("username")}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Medical Coding Specialist
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-red-50 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-red-100 group-hover:bg-red-200 rounded-full flex items-center justify-center transition-colors">
                      <LogOut className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 group-hover:text-red-800">
                        Sign Out
                      </div>
                      <div className="text-xs text-gray-500">
                        End current session
                      </div>
                    </div>
                  </button>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
                  <div className="text-xs text-gray-500 text-center">
                    PenguinAI Medical Coding Platform v2.1
                  </div>
                </div>
              </div>
            )}

            {/* Overlay to close dropdown when clicking outside */}
            {showUserMenu && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
