import { ErrorOutlineSharp } from '@mui/icons-material';
import { Alert, Snackbar } from '@mui/material';

interface ParamErrorsProps {
  /** The parameter error details to display */
  paramsError: { header: string; params: string[] } | null;
}

interface ErrorsProps {
  /** The general error message to display */
  generalError: string | null;
  /** The session error message to display */
  sessionError: string | null;
  /** Function to set the general error message */
  setGeneralError: (error: string | null) => void;
}

/**
 * A component for displaying general and session error messages.
 * @param props The props for the Errors component
 * @returns A Snackbar displaying the appropriate error message
 */
export function Errors(props: ErrorsProps) {
  const { generalError, sessionError, setGeneralError } = props;

  return (
    <Snackbar open={!!(generalError || sessionError)} autoHideDuration={6000} onClose={() => setGeneralError(null)}>
      <Alert severity="error" color="warning">
        {generalError || sessionError}
      </Alert>
    </Snackbar>
  );
}

/**
 * A component for displaying parameter error messages. This component is intended to replace any other UI if active.
 * @param props The props for the ParamErrors component
 * @returns A React element displaying the appropriate parameter error message
 */
export function ParamErrors(props: ParamErrorsProps) {
  return (
    <div id="params-error" className="flex items-center justify-center w-full h-full">
      <div className="min-h-36 min-w-2xs border-2 border-red-400">
        <h3 className="text-lg font-bold px-4 py-2 bg-red-400 text-white w-full">
          <ErrorOutlineSharp />
          &nbsp;Error
        </h3>
        <p className="text-lg font-bold mx-9 my-3">{props.paramsError?.header}</p>
        <ul className="text-lg mx-9 my-3 list-disc list-inside">
          {props.paramsError?.params.map((param, index) => (
            <li key={index}>{<code>{param}</code>}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  return null;
}
