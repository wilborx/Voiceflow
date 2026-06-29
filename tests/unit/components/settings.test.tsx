import { fireEvent, render, screen } from "@testing-library/react";
import React from "../../../apps/voiceflow/node_modules/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: {
    name: "VoiceFlow GmbH",
    email: "admin@voiceflow.test",
    timezone: "Europe/Berlin",
    language: "de",
  },
  updateSettings: vi.fn(),
  exportOrgData: vi.fn(),
  requestDataDeletion: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/layout/TopNav", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ComponentProps<"button">) =>
    React.createElement("button", { type: "button", ...props }, children),
  buttonVariants: () => "",
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: ComponentProps<"input">) =>
    React.createElement("input", props),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: ComponentProps<"label">) =>
    React.createElement("label", props, children),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: mocks.settings,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: mocks.requestDataDeletion,
    mutateAsync: mocks.updateSettings,
    isPending: false,
    isFetching: false,
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
  useQueryClient: vi.fn(),
}));

vi.mock("../../../apps/voiceflow/node_modules/@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: mocks.settings,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
  useMutation: vi.fn(() => ({
    mutate: mocks.requestDataDeletion,
    mutateAsync: mocks.updateSettings,
    isPending: false,
    isFetching: false,
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
  useQueryClient: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetSettings: () => ({
    data: mocks.settings,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useUpdateSettings: () => ({
    mutateAsync: mocks.updateSettings,
    isPending: false,
    isError: false,
  }),
  useListIntegrations: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
  useExportOrgData: () => ({ isFetching: false, isPending: false }),
  useRequestDataDeletion: () => ({
    mutate: mocks.requestDataDeletion,
    mutateAsync: mocks.requestDataDeletion,
    isPending: false,
    isError: false,
  }),
}));

vi.mock(
  "../../../apps/voiceflow/node_modules/@workspace/api-client-react",
  () => ({
    useGetSettings: () => ({
      data: mocks.settings,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    }),
    useUpdateSettings: () => ({
      mutateAsync: mocks.updateSettings,
      isPending: false,
      isError: false,
    }),
    useListIntegrations: () => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      isFetching: false,
    }),
    useExportOrgData: () => ({ isFetching: false, isPending: false }),
    useRequestDataDeletion: () => ({
      mutate: mocks.requestDataDeletion,
      mutateAsync: mocks.requestDataDeletion,
      isPending: false,
      isError: false,
    }),
  }),
);

import SettingsPage from "../../../apps/voiceflow/src/pages/settings";

describe("Settings DSGVO interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = vi.fn();
    mocks.updateSettings.mockResolvedValue(mocks.settings);
    mocks.requestDataDeletion.mockImplementation(
      (
        args: { data: { confirmation: string } },
        options?: { onSuccess?: () => void },
      ) => {
        if (args.data.confirmation === "DELETE_MY_DATA") {
          options?.onSuccess?.();
        }
      },
    );
  });

  it("exports organization data through the public API endpoint", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId("button-export-data"));

    expect(window.open).toHaveBeenCalledWith(
      "http://localhost:8080/api/settings/export",
      "_blank",
    );
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Export started",
      description: "Your data export will download in a new tab.",
    });
  });

  it("requests complete data deletion and shows completion toast", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId("button-delete-data"));
    fireEvent.change(screen.getByTestId("input-delete-confirmation"), {
      target: { value: "DELETE_MY_DATA" },
    });
    fireEvent.click(screen.getByTestId("button-confirm-delete-data"));

    expect(mocks.requestDataDeletion).toHaveBeenCalledWith(
      { data: { confirmation: "DELETE_MY_DATA" } },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(mocks.toast).toHaveBeenCalledWith({
      title: "Deletion complete",
      description: "All your data has been deleted.",
    });
  });

  it("opens AVV and privacy policy documents in new tabs", () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByTestId("button-avv-preview"));
    fireEvent.click(screen.getByTestId("button-privacy-policy"));

    expect(window.open).toHaveBeenCalledWith(
      "/api/settings/documents/avv.txt",
      "_blank",
    );
    expect(window.open).toHaveBeenCalledWith(
      "/api/settings/documents/privacy-policy.txt",
      "_blank",
    );
  });
});
