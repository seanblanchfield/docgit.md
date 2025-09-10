# Bug Recording Workflow

## Overview

This document establishes a systematic workflow for recording, tracking, and managing bugs within the project's WIP (Work In Progress) file system. It provides clear guidelines for developers to handle bugs discovered during feature development.

## Bug Classification System

### Severity Levels

- **Critical**: System crashes, data loss, security vulnerabilities, or complete feature failure
- **High**: Major functionality broken, significant user experience issues, or performance degradation
- **Medium**: Minor functionality issues, cosmetic problems that affect usability
- **Low**: Minor cosmetic issues, edge cases, or nice-to-have improvements

### Category Types

- **UI**: Frontend display issues, styling problems, user interface bugs
- **Backend**: Server-side logic errors, API issues, database problems
- **Integration**: Issues between frontend/backend, third-party service problems
- **Performance**: Slow loading, memory leaks, inefficient operations

### Bug Relationship to Current Work

- **Current Feature Bug**: Directly related to the feature being developed
- **Existing System Bug**: Pre-existing issue discovered during current work
- **Regression Bug**: Previously working functionality broken by recent changes

## Bug Report Template

Use this template when documenting bugs in WIP files:

```markdown
### Bug: [Short Description]
**Severity**: Critical/High/Medium/Low
**Category**: UI/Backend/Integration/Performance
**Relationship**: Current Feature/Existing System/Regression
**Context**: [When/where discovered during development]

**Steps to Reproduce**: 
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happens]
**Environment**: [Browser/OS/Docker version if relevant]

**Decision**: [Fix now/Add to current TODO/Create new TODO/Future consideration]
**Reasoning**: [Why this decision was made]
```

## Decision Criteria

### Fix Immediately
- Critical bugs that block current development
- Regression bugs caused by current changes
- Simple fixes that take less than 30 minutes

### Add to Current TODO
- Bugs directly related to the current feature
- Medium severity issues within current scope
- Bugs that can be fixed as part of current implementation

### Create New TODO
- Bugs in separate feature areas
- High/Medium severity existing system bugs
- Issues requiring significant investigation or refactoring

### Future Consideration
- Low severity cosmetic issues
- Edge cases with minimal user impact
- Performance optimizations not critical to current goals

## WIP File Integration

### Standard Section Structure

All WIP files should include a "Known Issues & Future Improvements" section:

```markdown
## Known Issues & Future Improvements

### Bugs Discovered During Development
[Use bug report template for each bug]

### Future Enhancements
[List potential improvements identified during work]

### Technical Debt
[Note any shortcuts or temporary solutions that need future attention]
```

### Bug Tracking in WIP Files

1. **Document as Discovered**: Record bugs immediately when found
2. **Update Progress**: Mark bugs as resolved when fixed
3. **Cross-Reference**: Link to new TODOs created for deferred bugs
4. **Final Review**: Ensure all bugs are addressed before marking TODO as DONE

## Workflow Guidelines

### During Feature Development

1. **Immediate Assessment**: When a bug is discovered, quickly assess severity and relationship
2. **Document First**: Always document the bug before deciding on action
3. **Apply Decision Criteria**: Use the decision matrix to determine next steps
4. **Update WIP File**: Record the bug and decision in the current WIP file
5. **Take Action**: Fix immediately, add to scope, or create new TODO as decided

### Bug Resolution Process

1. **Reproduce**: Verify the bug can be consistently reproduced
2. **Investigate**: Understand the root cause
3. **Fix**: Implement the solution
4. **Test**: Verify the fix works and doesn't introduce regressions
5. **Document**: Update the WIP file with resolution details

### Escalation Criteria

Escalate to user/team lead when:
- Critical bugs are discovered that significantly impact project timeline
- Bugs require architectural changes or major refactoring
- Multiple related bugs suggest systemic issues
- Uncertainty about whether to expand current scope vs create new TODO

## Integration with Development Process

### Code Review Considerations
- Include bug reports in commit messages when fixing bugs
- Reference WIP file sections in pull requests
- Ensure bug documentation is updated with resolution

### Testing Integration
- Add test cases for bugs to prevent regression
- Include bug scenarios in acceptance criteria
- Update test documentation with new edge cases

### Communication
- Use bug reports to communicate issues to team members
- Include bug summaries in project status updates
- Reference bug decisions in architectural discussions

## Templates and Examples

### Quick Bug Note Template
For minor issues that need quick documentation:

```markdown
**Bug**: [One-line description]
**Impact**: [User/system impact]
**Decision**: [Action taken]
```

### Bug Resolution Update Template
When marking a bug as resolved:

```markdown
**Resolution**: [How it was fixed]
**Commit**: [Commit hash if applicable]
**Testing**: [How the fix was verified]
**Date**: [Resolution date]
```

## Best Practices

1. **Be Specific**: Provide clear, actionable bug descriptions
2. **Include Context**: Note what you were doing when the bug was discovered
3. **Think User Impact**: Consider how the bug affects end users
4. **Document Decisions**: Always explain why you chose a particular action
5. **Update Promptly**: Keep bug status current as work progresses
6. **Cross-Reference**: Link related bugs and TODOs
7. **Learn from Patterns**: Look for common bug types to prevent future issues

## Metrics and Tracking

Track these metrics to improve the bug workflow:
- Time from discovery to resolution
- Bug severity distribution
- Bugs fixed immediately vs deferred
- Regression rate from new features
- Most common bug categories

This data helps refine the workflow and identify areas for process improvement.
