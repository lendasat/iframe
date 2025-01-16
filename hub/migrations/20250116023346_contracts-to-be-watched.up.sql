CREATE VIEW contracts_to_be_watched AS
SELECT *
FROM contracts
WHERE status IN
      ('Approved',
       'CollateralSeen',
       'CollateralConfirmed',
       'PrincipalGiven',
       'RepaymentProvided',
       'RepaymentConfirmed',
       'Closing',
       'DisputeBorrowerStarted',
       'DisputeLenderStarted',
       'DisputeBorrowerResolved',
       'DisputeLenderResolved',
       'Defaulted',
       'Undercollateralized',
       'RenewalRequested');
