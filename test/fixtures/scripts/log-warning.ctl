// Emits a WARNING log event via throwError/makeError.
// Run with: WCCOActrl log-warning.ctl -proj <name> -n
main()
{
    throwError(makeError("LogIntegTest", PRIO_WARNING, ERR_CONTROL, 42, "LogIntegTest WARNING message"));
    exit(0);
}
