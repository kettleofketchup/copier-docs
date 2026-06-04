# Update this project from its Copier template.
# `copier update` reads the template source from .copier-answers.yml.

TEMPLATE_SRC := env("TEMPLATE_SRC", "git@github.com:kettleofketchup/copier-docs.git")

# Update from the template (three-way merge; commit your work first)
[no-cd]
[group('copier')]
[confirm("Update this project from the template. Continue?")]
update:
    copier update --trust

# Preview the changes an update would make
[no-cd]
[group('copier')]
diff:
    copier update --trust --pretend --diff

# Re-copy the template fresh, keeping answers
[no-cd]
[group('copier')]
[confirm("Re-copy the template, possibly overwriting changes. Continue?")]
recopy:
    copier recopy --trust

# Show the recorded template answers
[no-cd]
[group('copier')]
answers:
    cat .copier-answers.yml
