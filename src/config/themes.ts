export const themeIds = [
  "midnight-hacker",
  "blood-moon",
  "deep-ocean",
  "phantom-purple",
  "golden-ember"
] as const;

export type ThemeId = (typeof themeIds)[number];

export interface TerminalTheme {
  id: ThemeId;
  name: string;
  tagline: string;
  header: {
    background: string;
    borderColor: string;
    title: string;
    subtitle: string;
    online: string;
    offline: string;
  };
  notice: {
    error: string;
    info: string;
    success: string;
    warning: string;
  };
  sidebar: {
    background: string;
    borderColor: string;
    sectionTitle: string;
    label: string;
    value: string;
    activeItem: string;
    inactiveItem: string;
    muted: string;
  };
  chat: {
    background: string;
    borderColor: string;
    paneTitle: string;
    senderSelf: string;
    senderOther: string;
    messageText: string;
    timestamp: string;
    system: string;
  };
  composer: {
    background: string;
    borderColor: string;
    prompt: string;
    inputText: string;
    cursor: string;
    placeholder: string;
  };
  auth: {
    title: string;
    subtitle: string;
    activeLabel: string;
    inactiveLabel: string;
    activeBorder: string;
    inactiveBorder: string;
    inputText: string;
    hints: string;
  };
}

export const DEFAULT_THEME_ID: ThemeId = "phantom-purple";

export const terminalThemes: Record<ThemeId, TerminalTheme> = {
  "midnight-hacker": {
    id: "midnight-hacker",
    name: "Midnight Hacker",
    tagline: "Classic phosphor terminal green.",
    header: {
      background: "#0D0D0D",
      borderColor: "#1A6600",
      title: "#00FF41",
      subtitle: "#00CC33",
      online: "#00FF41",
      offline: "#336633"
    },
    notice: {
      error: "red",
      info: "#00FF41",
      success: "#00CC33",
      warning: "yellow"
    },
    sidebar: {
      background: "#111111",
      borderColor: "#1A6600",
      sectionTitle: "#00CC33",
      label: "#557755",
      value: "#AAFFAA",
      activeItem: "#00FF41",
      inactiveItem: "#448844",
      muted: "#336633"
    },
    chat: {
      background: "#0D0D0D",
      borderColor: "#1A6600",
      paneTitle: "#00FF41",
      senderSelf: "#00FF41",
      senderOther: "#00CC33",
      messageText: "#CCFFCC",
      timestamp: "#336633",
      system: "#009920"
    },
    composer: {
      background: "#111111",
      borderColor: "#00FF41",
      prompt: "#00FF41",
      inputText: "#AAFFAA",
      cursor: "#00FF41",
      placeholder: "#336633"
    },
    auth: {
      title: "#00FF41",
      subtitle: "#00CC33",
      activeLabel: "#00FF41",
      inactiveLabel: "#448844",
      activeBorder: "#00FF41",
      inactiveBorder: "#1A6600",
      inputText: "#AAFFAA",
      hints: "#336633"
    }
  },
  "blood-moon": {
    id: "blood-moon",
    name: "Blood Moon",
    tagline: "Crimson cyber-noir with ember accents.",
    header: {
      background: "#0F0608",
      borderColor: "#5C1A28",
      title: "#FF2D55",
      subtitle: "#FF6B35",
      online: "#FF2D55",
      offline: "#662233"
    },
    notice: {
      error: "#FF2D55",
      info: "#FF6B35",
      success: "#44FF88",
      warning: "#FFB547"
    },
    sidebar: {
      background: "#160A0A",
      borderColor: "#5C1A28",
      sectionTitle: "#CC2244",
      label: "#882233",
      value: "#FFCCCC",
      activeItem: "#FF2D55",
      inactiveItem: "#662233",
      muted: "#4A2030"
    },
    chat: {
      background: "#0F0608",
      borderColor: "#5C1A28",
      paneTitle: "#FF2D55",
      senderSelf: "#FF2D55",
      senderOther: "#FF6B35",
      messageText: "#F0E0E5",
      timestamp: "#4A2030",
      system: "#AA3344"
    },
    composer: {
      background: "#160A0A",
      borderColor: "#FF2D55",
      prompt: "#FF2D55",
      inputText: "#FFCCCC",
      cursor: "#FF2D55",
      placeholder: "#4A2030"
    },
    auth: {
      title: "#FF2D55",
      subtitle: "#FF6B35",
      activeLabel: "#FF2D55",
      inactiveLabel: "#662233",
      activeBorder: "#FF2D55",
      inactiveBorder: "#5C1A28",
      inputText: "#FFCCCC",
      hints: "#4A2030"
    }
  },
  "deep-ocean": {
    id: "deep-ocean",
    name: "Deep Ocean",
    tagline: "Cold navy sonar with electric cyan.",
    header: {
      background: "#030D1A",
      borderColor: "#0A3A5A",
      title: "#00D4FF",
      subtitle: "#0088CC",
      online: "#00FFCC",
      offline: "#224466"
    },
    notice: {
      error: "#FF4466",
      info: "#00D4FF",
      success: "#00FFAA",
      warning: "#FFCC00"
    },
    sidebar: {
      background: "#060F20",
      borderColor: "#0A3A5A",
      sectionTitle: "#007AB8",
      label: "#224A6A",
      value: "#B8DEFF",
      activeItem: "#00D4FF",
      inactiveItem: "#224466",
      muted: "#153050"
    },
    chat: {
      background: "#030D1A",
      borderColor: "#0A3A5A",
      paneTitle: "#00D4FF",
      senderSelf: "#00D4FF",
      senderOther: "#0088CC",
      messageText: "#C0D8F0",
      timestamp: "#153050",
      system: "#0088CC"
    },
    composer: {
      background: "#060F20",
      borderColor: "#00D4FF",
      prompt: "#00D4FF",
      inputText: "#B8DEFF",
      cursor: "#00D4FF",
      placeholder: "#153050"
    },
    auth: {
      title: "#00D4FF",
      subtitle: "#0088CC",
      activeLabel: "#00D4FF",
      inactiveLabel: "#224466",
      activeBorder: "#00D4FF",
      inactiveBorder: "#0A3A5A",
      inputText: "#B8DEFF",
      hints: "#153050"
    }
  },
  "phantom-purple": {
    id: "phantom-purple",
    name: "Phantom Purple",
    tagline: "Violet-black TerminalTalk default.",
    header: {
      background: "#08060F",
      borderColor: "#3D2A5E",
      title: "#A855F7",
      subtitle: "#6366F1",
      online: "#C084FC",
      offline: "#3D2A5E"
    },
    notice: {
      error: "#F43F5E",
      info: "#6366F1",
      success: "#22D3EE",
      warning: "#F59E0B"
    },
    sidebar: {
      background: "#0E0B1A",
      borderColor: "#3D2A5E",
      sectionTitle: "#7C3AED",
      label: "#4C2A8E",
      value: "#D8C8FF",
      activeItem: "#A855F7",
      inactiveItem: "#3D2A5E",
      muted: "#2D1B45"
    },
    chat: {
      background: "#08060F",
      borderColor: "#3D2A5E",
      paneTitle: "#A855F7",
      senderSelf: "#C084FC",
      senderOther: "#6366F1",
      messageText: "#D8D0F0",
      timestamp: "#2D1B45",
      system: "#7C3AED"
    },
    composer: {
      background: "#0E0B1A",
      borderColor: "#A855F7",
      prompt: "#A855F7",
      inputText: "#D8C8FF",
      cursor: "#C084FC",
      placeholder: "#2D1B45"
    },
    auth: {
      title: "#A855F7",
      subtitle: "#6366F1",
      activeLabel: "#A855F7",
      inactiveLabel: "#3D2A5E",
      activeBorder: "#A855F7",
      inactiveBorder: "#3D2A5E",
      inputText: "#D8C8FF",
      hints: "#2D1B45"
    }
  },
  "golden-ember": {
    id: "golden-ember",
    name: "Golden Ember",
    tagline: "Warm amber hacker-at-2am shell.",
    header: {
      background: "#0C0C08",
      borderColor: "#3A2800",
      title: "#F0A500",
      subtitle: "#E05C00",
      online: "#F0A500",
      offline: "#5A3800"
    },
    notice: {
      error: "#FF3030",
      info: "#F0A500",
      success: "#78C850",
      warning: "#FFC300"
    },
    sidebar: {
      background: "#141008",
      borderColor: "#3A2800",
      sectionTitle: "#B87800",
      label: "#7A5000",
      value: "#FFE8A0",
      activeItem: "#F0A500",
      inactiveItem: "#5A3800",
      muted: "#3A2800"
    },
    chat: {
      background: "#0C0C08",
      borderColor: "#3A2800",
      paneTitle: "#F0A500",
      senderSelf: "#FFB800",
      senderOther: "#E05C00",
      messageText: "#EEE0C0",
      timestamp: "#3A2800",
      system: "#B87800"
    },
    composer: {
      background: "#141008",
      borderColor: "#F0A500",
      prompt: "#F0A500",
      inputText: "#FFE8A0",
      cursor: "#F0A500",
      placeholder: "#3A2800"
    },
    auth: {
      title: "#F0A500",
      subtitle: "#E05C00",
      activeLabel: "#F0A500",
      inactiveLabel: "#5A3800",
      activeBorder: "#F0A500",
      inactiveBorder: "#3A2800",
      inputText: "#FFE8A0",
      hints: "#3A2800"
    }
  }
};

export function getTheme(themeId: ThemeId): TerminalTheme {
  return terminalThemes[themeId];
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themeIds.includes(value as ThemeId);
}
