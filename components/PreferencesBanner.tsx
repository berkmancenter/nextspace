import { FC, useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, alpha } from "@mui/material";
import { Settings, ErrorOutline } from "@mui/icons-material";

export interface PreferenceOption {
  value: string;
  label: string;
  description?: string;
}

export interface PreferencesBannerProps {
  title?: string;
  description?: string;
  options: PreferenceOption[];
  onSubmit: (selectedValues: string[]) => void;
  onDismiss?: () => void;
  error?: string | null;
}

export const PreferencesBanner: FC<PreferencesBannerProps> = ({
  title = "Set Your Preferences",
  description = "Help us personalize your experience by selecting your preferences below.",
  options,
  onSubmit,
  onDismiss,
  error = null,
}) => {
  const [selected, setSelected] = useState<string[]>([]);

  const handleToggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  };

  const handleSubmit = () => {
    onSubmit(selected);
  };

  return (
    <Box
      sx={{
        backgroundColor: "#F8F5FC",
        border: "2px solid #4A0979",
        borderRadius: "8px",
        padding: "0.75rem",
        marginBottom: "1rem",
        boxShadow: "0 2px 8px rgba(74, 9, 121, 0.1)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <Settings sx={{ color: "#4A0979", fontSize: "1.25rem" }} />
        <Box>
          <h3
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 700,
              color: "#4A0979",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#666",
              marginTop: "0.125rem",
            }}
          >
            {description}
          </p>
        </Box>
      </Box>

      {/* Options */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "0.125rem",
          marginTop: "0.5rem",
        }}
      >
        {options.map((option, index) => {
          const isSelected = selected.includes(option.value);
          return (
            <FormControlLabel
              key={`pref-${index}`}
              control={
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleToggle(option.value)}
                  sx={{
                    color: "#4A0979",
                    padding: "2px",
                    "&.Mui-checked": {
                      color: "#4A0979",
                    },
                  }}
                />
              }
              label={
                <Box>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                    {option.label}
                  </div>
                  {option.description && (
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: "#666",
                        marginTop: "1px",
                      }}
                    >
                      {option.description}
                    </div>
                  )}
                </Box>
              }
              sx={{
                marginLeft: 0,
                marginRight: 0,
                paddingY: "2px",
                paddingX: "6px",
                borderRadius: "4px",
                transition: "background-color 0.2s",
                "&:hover": {
                  backgroundColor: alpha("#4A0979", 0.05),
                },
                "& .MuiFormControlLabel-label": {
                  marginLeft: "6px",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Error Message */}
      {error && (
        <Box
          sx={{
            backgroundColor: "#FEE2E2",
            border: "1px solid #DC2626",
            borderRadius: "4px",
            padding: "0.5rem",
            marginTop: "0.5rem",
            fontSize: "0.8125rem",
            color: "#991B1B",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <ErrorOutline sx={{ fontSize: "1rem" }} />
          <span>{error}</span>
        </Box>
      )}

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.5rem",
          justifyContent: "flex-end",
        }}
      >
        {onDismiss && (
          <Button
            variant="text"
            size="small"
            onClick={onDismiss}
            sx={{
              textTransform: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#666",
            }}
          >
            Skip for now
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={selected.length === 0}
          sx={{
            textTransform: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            backgroundColor: "#4A0979",
            "&:hover": {
              backgroundColor: "#3A0759",
            },
          }}
        >
          Save Preferences
        </Button>
      </Box>
    </Box>
  );
};
