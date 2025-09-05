import type React from "react";
import { ExecutionsContainer } from "@/webview/views/executionResults/components/Executions";
import { StepOutputsContainer } from "@/webview/views/executionResults/components/StepOutputs";
import { StepResultsContainer } from "@/webview/views/executionResults/components/StepResults";
import { Container, Grid } from "@/webview/views/executionResults/styles";

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
