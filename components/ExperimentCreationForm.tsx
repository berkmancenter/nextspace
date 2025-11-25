"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { ExpandMoreOutlined, PlayArrowSharp } from "@mui/icons-material";

import { components } from "../types";
import { RetrieveData, SendData } from "../utils";
import { AgentConfigForm } from "./AgentConfigForm";

const agentOptions = [
  {
    id: "backChannelInsights",
    label: "Back Channel Insights",
    value: {
      prompts: ["insights", "hallucinationFlags"],
    },
    description:
      "An agent to analyze participant comments and generate insights for the moderator",
  },
  {
    id: "eventAssistant",
    label: "Event Assistant",
    value: {
      prompts: ["timeWindowSystem", "semanticSystem", "user"],
    },
    description: "An assistant to answer questions about an event",
  },
];

interface ExperimentCreationFormProps {
  token?: string;
}

export const ExperimentCreationForm: React.FC<ExperimentCreationFormProps> = ({
  token,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [selectedAgents, setSelectedAgents] = useState<string[] | null>(null);
  const [currentConversations, setCurrentConversations] = useState<
    components["schemas"]["Conversation"][]
  >([]);
  const [conversationData, setConversationData] = useState<
    components["schemas"]["Conversation"] | null
  >(null);
  const [experimentData, setExperimentData] = useState<
    components["schemas"]["Experiment"] | null
  >(null);
  const [experimentAgentId, setExperimentAgentId] = useState<string>("");
  const [experimentRunData, setExperimentRunData] = useState<string>("");
  const [experimentStatus, setExperimentStatus] = useState<
    "none" | "creating" | "started"
  >("none");

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  // Fetch conversations on mount
  useEffect(() => {
    if (currentConversations.length > 0) return;

    const fetchConversations = async () => {
      try {
        const data = (await RetrieveData(
          "conversations/active",
          token
        )) as components["schemas"]["Conversation"][];
        setCurrentConversations(data);
      } catch (error) {
        console.error("Error fetching conversations:", error);
      }
    };
    fetchConversations();
  }, [currentConversations, token]);

  // Fetch conversation data when selected
  useEffect(() => {
    if (!selectedConversationId) return;

    const fetchConversationData = async () => {
      try {
        const data = (await RetrieveData(
          `/conversations/${selectedConversationId}`,
          token
        )) as components["schemas"]["Conversation"];

        if (!data || !data.agents || data.agents.length === 0) {
          setFormError("Conversation has no agents, select another.");
          return;
        }

        setConversationData(data);

        // Set experiment agent ID
        let experimentAgentId = data.agents.find(
          (agent) => agent.agentType === "backChannelMetrics"
        )?.id;
        if (!experimentAgentId) {
          experimentAgentId = data.agents[0].id;
        }
        if (!experimentAgentId) {
          setFormError("No valid agent found for the experiment.");
          return;
        }
        setExperimentAgentId(experimentAgentId);
      } catch (error) {
        console.error("Error fetching conversation data:", error);
      }
    };

    fetchConversationData();
  }, [selectedConversationId, token]);

  const sendData = (formData: FormData) => {
    let agentTypes: any[] = [];
    const hasMetricsAgent = Array.from(formData.entries()).some(([key]) =>
      key.startsWith("backChannelMetrics")
    );

    if (hasMetricsAgent) {
      agentTypes.push({
        name: "backChannelMetrics",
        llmPlatform: "openai",
        llmModel:
          formData.get("backChannelMetrics.llmModel")?.toString() ||
          "gpt-4-turbo",
        llmModelOptions: {
          temperature: parseFloat(
            formData.get(
              "backChannelMetrics.llmModelOptions.temperature"
            ) as string
          ),
        },
        llmTemplates: {
          classification: formData
            .get("backChannelMetrics.llmTemplates.classification")
            ?.toString(),
        },
        agentConfig: {
          reportingThreshold: parseFloat(
            formData.get(
              "backChannelMetrics.agentConfig.reportingThreshold"
            ) as string
          ),
        },
      });
    }

    const body = {
      name: formData.get("name"),
      baseConversation: selectedConversationId,
      agentModifications: [
        {
          agent: experimentAgentId,
          experimentValues: {
            llmPlatform: agentTypes[0].llmPlatform,
            llmModel: agentTypes[0].llmModel,
            llmModelOptions: agentTypes[0].llmModelOptions,
            llmTemplates: agentTypes[0].llmTemplates,
            agentConfig: agentTypes[0].agentConfig,
          },
        },
      ],
    };

    SendData("experiments", body)
      .then((data) => {
        if (!data) {
          setFormError("Failed to send data. Please try again.");
          return;
        }
        setExperimentData(data as components["schemas"]["Experiment"]);
        setFormSubmitted(true);
      })
      .catch((error) => {
        console.error("Error sending data:", error);
        setFormError(`Failed to send data. (${error.message})`);
      });
  };

  const submitStartExperiment = async () => {
    if (!experimentData || !experimentData.id) {
      setFormError("Experiment data is not available.");
      return;
    }
    try {
      setExperimentStatus("creating");
      await SendData(`experiments/${experimentData.id}/run`, {})
        .then(async (res) => {
          if (res) {
            setExperimentStatus("started");
            const results = await RetrieveData(
              `experiments/${experimentData.id}/results?reportName=periodicResponses&format=text`,
              token,
              "text"
            );
            setExperimentRunData(results);
          }
        })
        .catch((error) => {
          console.error("Error starting experiment:", error);
          setFormError("Failed to start experiment. Please try again.");
          setExperimentStatus("none");
        });
    } catch (error) {
      console.error("Error starting experiment:", error);
      setFormError("Failed to start experiment. Please try again.");
      setExperimentStatus("none");
    }
  };

  // Success component
  const ExperimentReady = () => {
    if (!experimentData || !experimentData.id) return null;
    return (
      <>
        <Typography variant="h5" component="h2" gutterBottom>
          Experiment configuration submitted successfully!
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Name:</Typography>
          <Typography variant="body2" gutterBottom>
            {experimentData.name}
          </Typography>
          {experimentData.baseConversation && (
            <>
              <Typography variant="subtitle1">
                Base Conversation Name:
              </Typography>
              <Typography variant="body2" gutterBottom>
                {conversationData?.name}
              </Typography>
            </>
          )}
        </Box>
        {!experimentRunData ? (
          <>
            <Typography variant="body1" component="p" gutterBottom>
              If you want to start this experiment, click below, and then you
              will be redirected to the status page when it has started
              successfully.
            </Typography>
            <Button
              variant="contained"
              color="success"
              loading={experimentStatus === "creating"}
              loadingPosition="end"
              startIcon={<PlayArrowSharp />}
              onClick={() => submitStartExperiment()}
            >
              Start Experiment
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h6" component="h6">
              Experiment Results:
            </Typography>
            <Paper elevation={24} square={false}>
              <Box sx={{ mt: 2, p: 2 }}>
                <pre>{experimentRunData}</pre>
              </Box>
            </Paper>
          </>
        )}
      </>
    );
  };

  if (formSubmitted && experimentData) {
    return (
      <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: "auto", mt: 4 }}>
        <ExperimentReady />
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: "auto", mt: 4 }}>
      {formError && (
        <Snackbar
          open={Boolean(formError)}
          autoHideDuration={5000}
          onClose={() => setFormError(null)}
        >
          <Alert
            variant="outlined"
            severity="error"
            onClose={() => setFormError(null)}
            sx={{ mt: 2 }}
          >
            {formError}
          </Alert>
        </Snackbar>
      )}

      <Box
        component="form"
        noValidate
        action="#"
        ref={formRef}
        onChange={() => {
          // Validation logic if needed
        }}
      >
        <Typography variant="h5" component="h2" gutterBottom>
          Experiment Configuration
        </Typography>

        {/* Base Conversation Selection */}
        {currentConversations.length > 0 && (
          <FormControl fullWidth margin="normal">
            <InputLabel id="conversation-select-label">
              Base Conversation
            </InputLabel>
            <Select
              labelId="conversation-select-label"
              value={selectedConversationId ?? ""}
              id="conversation-select"
              name="conversationId"
              label="Base Conversation"
              onChange={(e) => setSelectedConversationId(e.target.value)}
            >
              {currentConversations.map((conversation) => (
                <MenuItem key={conversation.id} value={conversation.id}>
                  {conversation.name} <Chip label={conversation.messageCount} />{" "}
                  <Chip label={conversation.id} />
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Select an existing conversation to base this experiment on
            </FormHelperText>
          </FormControl>
        )}

        {selectedConversationId && (
          <>
            {/* Agent Selection */}
            <FormControl fullWidth margin="normal">
              <InputLabel id="agents-select-label">Agents</InputLabel>
              <Select
                labelId="agents-select-label"
                id="agents-select"
                value={selectedAgents || []}
                label="Agents"
                multiple
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip
                        key={value}
                        label={
                          agentOptions.find((option) => option.id === value)
                            ?.label
                        }
                      />
                    ))}
                  </Box>
                )}
                onChange={(e) => {
                  const value = e.target.value as string[];
                  setSelectedAgents(value);
                }}
              >
                {agentOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    <div className="flex flex-col justify-start items-start">
                      <strong className="text-medium-slate-blue">
                        {option.label}
                      </strong>
                      <p className="text-gray-600 text-sm">
                        {option.description}
                      </p>
                    </div>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Select agents to include in this experiment
              </FormHelperText>
            </FormControl>

            {/* Debug Information */}
            {process.env.NODE_ENV === "development" && conversationData && (
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreOutlined />}
                  aria-controls="panel-debug"
                  id="pane-debug"
                >
                  <Typography component="span">DEBUG: Response</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre>{JSON.stringify(conversationData, null, 3)}</pre>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Experiment Name */}
            <TextField
              name="name"
              fullWidth
              label="Experiment Name"
              id="experiment-name"
              defaultValue={conversationData?.name || ""}
              required
              variant="outlined"
              margin="normal"
            />

            {/* Agent Configuration Forms */}
            {conversationData?.agents?.map(
              (agent: components["schemas"]["Agent"], i: number) => (
                <AgentConfigForm
                  key={`agent-${i}`}
                  agent={agent}
                  agentId={agent.agentType!}
                />
              )
            )}
          </>
        )}

        <Box sx={{ mt: 4, textAlign: "right" }}>
          <Button
            type="submit"
            disabled={!selectedConversationId}
            variant="outlined"
            onClick={(e) => {
              e.preventDefault();
              if (formRef.current) sendData(new FormData(formRef.current));
            }}
          >
            Create Experiment
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};
