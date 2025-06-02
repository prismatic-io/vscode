import type React from "react";
import { Container, Grid } from "@/webview/views/executionResults/styles";
import { StepOutputsContainer } from "@/webview/views/executionResults/components/StepOutputs";
import { ExecutionsContainer } from "@/webview/views/executionResults/components/Executions";
import { StepResultsContainer } from "@/webview/views/executionResults/components/StepResults";

export const App: React.FC = () => {
  return (
    <Container>
      <Grid>
        <ExecutionsContainer />
        <StepResultsContainer />
        <StepOutputsContainer />
      </Grid>
    </Container>
  );
};
