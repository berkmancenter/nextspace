// EventFormShared.tsx
import React, { FC, useState } from "react";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
  FormHelperText,
  Divider,
  FormGroup,
} from "@mui/material";
import { components } from "../types";

const SentenceCaseLabel = (str: string) =>
  str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (str) => str.toUpperCase());

const DEFAULT_MODEL = "gpt-4-turbo";

// TODO get available agent types from backend config
const DEFAULT_AGENTS: Record<string, components["schemas"]["Agent"]> = {};

const TemperatureSlider: FC<{
  defaultValue?: number;
  name?: string;
}> = ({ defaultValue, name = "llmModelOptions.temperature" }) => {
  const [sliderValue, setSliderValue] = useState(defaultValue || 0.7);
  return (
    <>
      <Typography id="temperature-slider" gutterBottom>
        Temperature: {sliderValue}
      </Typography>
      <Slider
        value={sliderValue}
        onChange={(e, newValue) => setSliderValue(newValue as number)}
        defaultValue={defaultValue || 0.7}
        name={name}
        aria-labelledby="temperature-slider"
        step={0.1}
        marks
        min={0}
        max={1}
        color="secondary"
      />
    </>
  );
};

interface AgentConfigFormProps {
  agent?: components["schemas"]["Agent"];
  name?: string;
  agentId: string;
  selectedPlatforms?: string[];
  botNames?: Record<string, string | null>;
  onBotNameChange?: (agentType: string, name: string) => void;
}

export const AgentConfigForm: FC<AgentConfigFormProps> = ({
  agent,
  name,
  agentId,
  selectedPlatforms = [],
  botNames = {},
  onBotNameChange,
}) => {
  return (
    <>
      <Box sx={{ mt: 4 }}>
        <Divider />
        <Typography variant="h6" sx={{ mt: 2 }} fontWeight={"bold"}>
          Agent Configuration
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle1" gutterBottom>
              {SentenceCaseLabel(name || "Agent")}
            </Typography>

            {/* Zoom Bot Name */}
            {agentId === "backChannelInsights" &&
              selectedPlatforms.includes("zoom") && (
                <TextField
                  name="zoomBotName"
                  label="Zoom Bot Name"
                  id="zoom-bot-name"
                  defaultValue={botNames["zoom"] || ""}
                  required
                  variant="outlined"
                  margin="normal"
                  onChange={(e) => onBotNameChange?.("zoom", e.target.value)}
                />
              )}

            {/* Event Assistant Bot Name */}
            {agentId === "eventAssistant" && (
              <TextField
                name="eventAssistantBotName"
                label="Event Assistant Bot Name"
                id="event-assistant-bot-name"
                defaultValue={botNames["eventAssistant"] || ""}
                required
                variant="outlined"
                margin="normal"
                onChange={(e) =>
                  onBotNameChange?.("eventAssistant", e.target.value)
                }
              />
            )}
          </Grid>

          {DEFAULT_AGENTS[agentId]?.llmPlatform && (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel id="platform-select-label">
                    LLM Platform
                  </InputLabel>
                  <Select
                    labelId="platform-select-label"
                    id="platform-select"
                    name={`${agentId}.llmPlatform`}
                    value={agent?.llmPlatform || "openai"}
                    label="LLM Platform"
                    disabled
                  >
                    <MenuItem value="openai">OpenAI</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="LLM Model"
                  name={`${agentId}.llmModel`}
                  id="llm-model"
                  required
                  variant="outlined"
                  defaultValue={agent?.llmModel || DEFAULT_MODEL}
                />
              </Grid>
              <Box component="fieldset">
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormHelperText>
                    Lower values make responses more deterministic, higher
                    values more creative
                  </FormHelperText>
                  <TemperatureSlider
                    name={`${agentId}.llmModelOptions.temperature`}
                    defaultValue={
                      (agent?.llmModelOptions?.temperature as number) || 0.7
                    }
                  />
                </Grid>
              </Box>
            </>
          )}

          {agentId === "backChannelMetrics" && (
            <>
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Categories
                </Typography>
                <FormGroup row>
                  {["Boredom", "Inaudible", "Confusion"].map((category) => {
                    return (
                      <FormControl key={category} sx={{ mr: 2 }}>
                        <label>
                          <input
                            type="checkbox"
                            name={`${agentId}.agentConfig.categories`}
                            value={category}
                            defaultChecked={(
                              agent?.agentConfig?.categories as
                                | string[]
                                | undefined
                            )?.includes(category)}
                          />
                          <span className="ml-1">{category}</span>
                        </label>
                      </FormControl>
                    );
                  })}
                </FormGroup>
                <FormHelperText>
                  Select which categories for the agent to analyze
                </FormHelperText>
              </Box>
              <Box sx={{ mt: 4 }}>
                <TextField
                  type="number"
                  name={`${agentId}.agentConfig.reportingThreshold`}
                  label="Reporting Threshold"
                  defaultValue={agent?.agentConfig?.reportingThreshold ?? 1}
                  variant="outlined"
                  margin="normal"
                />
              </Box>
            </>
          )}
        </Grid>
      </Box>
    </>
  );
};
