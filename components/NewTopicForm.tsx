"use client";
import React from "react";
import { Box, Checkbox, FormControlLabel, TextField } from "@mui/material";

export interface NewTopicFormValues {
  name: string;
  description: string;
  public: boolean;
}

interface NewTopicFormProps {
  values: NewTopicFormValues;
  onChange: (values: NewTopicFormValues) => void;
}

export const NewTopicForm: React.FC<NewTopicFormProps> = ({
  values,
  onChange,
}) => {
  const [nameHasError, setNameHasError] = React.useState(false);

  return (
    <Box>
      <TextField
        label="Series Name"
        fullWidth
        required
        variant="outlined"
        margin="dense"
        value={values.name}
        error={nameHasError}
        helperText={nameHasError ? "Series name is required." : undefined}
        onBlur={() => setNameHasError(!values.name.trim())}
        onChange={(e) => {
          setNameHasError(false);
          onChange({ ...values, name: e.target.value });
        }}
      />
      <TextField
        label="Series Description"
        fullWidth
        variant="outlined"
        margin="dense"
        multiline
        rows={4}
        value={values.description}
        onChange={(e) => onChange({ ...values, description: e.target.value })}
        helperText="Optional description for this series."
      />
      <FormControlLabel
        sx={{ mt: 1 }}
        control={
          <Checkbox
            checked={values.public}
            onChange={(e) => onChange({ ...values, public: e.target.checked })}
            size="small"
          />
        }
        label="Public"
      />
    </Box>
  );
};
