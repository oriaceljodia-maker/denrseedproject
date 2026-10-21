export const AccountSetupStepsComponent = {
  render(activeStep) {
    const labels = ['Create your password', 'Connect or verify your authenticator', 'Access your dashboard'];
    return `<ol class="account-setup-steps" aria-label="Account setup progress">${labels.map((label, index) => {
      const step = index + 1;
      return `<li class="${step < activeStep ? 'is-complete' : ''}"${step === activeStep ? ' aria-current="step"' : ''}>
        <span class="account-setup-number" aria-hidden="true">${step < activeStep ? '✓' : step}</span>
        <span><small>Step ${step}</small>${label}</span>
      </li>`;
    }).join('')}</ol>`;
  }
};
