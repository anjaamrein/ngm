describe('The Home Page', () => {
  it('sucessfully loads', () => {
    cy.visit('/');
    cy.get('.ngm-determinate-loader > .loader', {timeout: 1000}).not('.determinate');
    cy.get('.ngm-determinate-loader > .loader', {timeout: 4000}).should('have.class', 'determinate');
    cy.get('.ngm-main-load-dimmer').not('.active', {timeout: 180000});
    cy.get('ngm-tracking-consent').contains(
      /Continue without data acquisition|Continuer sans acquisition de données/).click();
  });
});
