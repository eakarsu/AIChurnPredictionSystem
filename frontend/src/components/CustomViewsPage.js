import React from 'react';
import ChurnCohortHeatmap from './ChurnCohortHeatmap';
import RiskSegmentTreemap from './RiskSegmentTreemap';
import AtRiskCSVExport from './AtRiskCSVExport';
import SaveOfferWizard from './SaveOfferWizard';

export default function CustomViewsPage() {
  return (
    <div data-testid="custom-views-page">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: '#fff', margin: 0 }}>Retention Views</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 6 }}>
          Custom retention intelligence: cohort retention triangle, churn-risk heatmap (segment x behavior),
          at-risk customer PDF report, and a retention playbook editor for intervention rules.
        </p>
      </div>
      <ChurnCohortHeatmap />
      <RiskSegmentTreemap />
      <AtRiskCSVExport />
      <SaveOfferWizard />
    </div>
  );
}
