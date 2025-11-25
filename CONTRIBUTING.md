<!-- omit in toc -->

# Contributing to NextSpace

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions. 🎉

> And if you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation, which we would also be very happy about:
>
> - Star the project
> - Tweet about it
> - Refer this project in your project's readme
> - Mention the project at local meetups and tell your friends/colleagues

<!-- omit in toc -->

## Table of Contents

- [Asking Questions](#asking-questions)
- [Contributing](#contributing)
  - [Getting Started](#getting-started)
  - [What to Work On](#what-to-work-on)
- [Styleguides](#styleguides)
  - [Commit Messages](#commit-messages)
- [Code of Conduct](#code-of-conduct)

## Asking Questions

> Before you ask a question, please search the existing [Issues](https://github.com/berkmancenter/nextspace/issues) to see if your question has been addressed.

If you still have a question or need clarification, we recommend the following:

- Open an [Issue](https://github.com/berkmancenter/nextspace/issues/new/choose).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

We will address the issue as soon as possible.

## Reporting Bugs

> ### Sensitive Bugs <!-- omit in toc -->
>
> Never report security related issues, vulnerabilities or bugs including sensitive information to the issue tracker, or elsewhere in public. Instead, please send sensitive bugs by email to <asml@cyber.harvard.edu>.

<!-- omit in toc -->

### Before Submitting a Bug Report

- Check [Github Issues](https://github.com/berkmancenter/nextspace/issues?q=label%3Abug) to make sure the bug has not already been reported.
- Ensure the bug is not an error on your end. For example, ensure you are using the latest version of NextSpace and that you are using compatible environment components/versions.
<!-- omit in toc -->

### Submitting Your Report

Bug reports can be submitted to [GitHub Issues](https://github.com/berkmancenter/nextspace/issues/new/choose). Please select the appropriate issue type, use a descriptive and concise title, and follow the prompts.

Once it's filed, a team member will attempt to reproduce the issue with your provided steps. If reproduced, the project team will triage accordingly. If there are no reproduction steps or no obvious way to reproduce the issue, the team will ask you for clarification. Bugs will not be addressed until they are reproduced by a team member.

## Contributing

> ### Legal Notice <!-- omit in toc -->
>
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content, and that the content you contribute may be provided under the project license.

### Getting Started

We would love for you to contribute to NextSpace! To set up your development environment, please refer to our [README](https://github.com/berkmancenter/nextspace/blob/main/README.md). The instructions there should allow you to run NextSpace locally on your machine.

If you have any questions about the instructions, please feel free to [submit an issue](https://github.com/berkmancenter/nextspace/issues/new). We welcome any suggestions for improvements to the README from contributors, especially as a Pull Request to the documentation itself.

### What to Work On

You can see what the NextSpace team is working on in the [NextSpace Public Workstream](https://github.com/orgs/berkmancenter/projects/6). We would **love** your help, and that's the place to start.

## Styleguides

### Commit Messages

We prefer longform "conventional commit" messages where possible! Check out [conventional commits](https://www.conventionalcommits.org/en) and [this article](https://meedan.com/post/how-to-write-longform-git-commits-for-better-software-development) for more on longform commits.

**Not ideal:**

```
Fix our multiply function
```

**Ideal:**

```
feat: fix our multiply function
Swapped `/` for `*`. Apparently multiplication and division are two different
things! We want to do
[multiplication](https://en.wikipedia.org/wiki/Multiplication) because
otherwise everything breaks. I did some research and found out that `*`
means "multiply" in most popular programming languages.

In the future we could also consider dividing by the inverse of an operand,
in case we move to a programming langauge that doesn't support multiplication.

Fixes #1234.
```

## Use Conventional Commit Messages

Commit messages should follow the [Conventional Commit Message](https://www.conventionalcommits.org/en/v1.0.0/) pattern of `<type>: <description>`. Some examples are below.

- feat: - A new feature
- fix: - A bug fix
- chore: - Routine tasks, maintenance, dependencies
- docs: - Documentation changes
- style: - Code style/formatting changes (not affecting logic)
- refactor: - Code changes that neither fix bugs nor add features
- test: - Adding or correcting tests
- perf: - Performance improvements

When you run `git commit`, it will execute commitizen, an interactive tool that will help you build the commit message in the proper format. If you supply a message with `git commit -m`, the commit will fail if the message is not in the proper format.

## Code of Conduct

This project and everyone participating in it is governed by the
[NextSpace Code of Conduct](https://github.com/berkmancenter/nextspace/blob/CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable behavior
to <asml@cyber.harvard.edu>.

<!-- omit in toc -->

## Attribution

This guide is based on the [contributing.md](https://contributing.md/generator)!
