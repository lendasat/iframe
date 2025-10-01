-- Revert ClosingByClaim back to Closing

UPDATE contracts SET status = 'Closing' WHERE status = 'ClosingByClaim';